/**
 * Allowlist-based HTML sanitizer for outbound automation messages whose
 * body is authored in the Tiptap rich-text editor on the admin side.
 *
 * Tiptap's `getHTML()` output is well-formed but the message body still
 * crosses an untrusted boundary (it's persisted in `step.config.message`,
 * which a compromised admin or a misbehaving extension could poison).
 * Running the markup through this filter before `dangerouslySetInnerHTML`
 * keeps the widget honest:
 *
 *   - Drops every tag not in `ALLOWED_TAGS`. `<script>`, `<style>`,
 *     `<iframe>` and other code-execution / fingerprinting vectors are
 *     replaced with empty content (NOT their text body — historically
 *     we kept the textContent, but that smuggles `<script>alert()` body
 *     into a confusing visible payload while doing nothing useful).
 *   - Drops every attribute not on the allowlist. `style` is *not* in
 *     the global set: a `style="position:fixed;inset:0"` on any tag is
 *     enough to UI-redress the host page and `style="background:url(...)"`
 *     leaks the visitor's IP/UA on a fingerprinting URL. Visual styling
 *     is left to the widget's own CSS.
 *   - `<a>` is forced to `target="_blank" rel="noopener noreferrer"` so
 *     links never break out of the widget context.
 *   - Strips `javascript:` / `data:` (non-image) / `vbscript:` URLs
 *     from `href` / `src`.
 *
 * Trade-off: we use the browser's `DOMParser` rather than ship
 * `dompurify` — bundle size matters for a 60 kB widget and Tiptap's
 * output is narrow enough that a 100-line filter covers the threat
 * model. If we ever need broader HTML support (free-form user-pasted
 * HTML, third-party email rendering) reach for the library.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'img',
  'figure',
  'figcaption',
  // `iframe` was previously here for the Tiptap VideoEmbed extension
  // but it's not safe to ship without a strict origin allowlist + a
  // forced `sandbox` attribute (and even then `allow-scripts` opens
  // keylogger surfaces). Rich video previews can come back later as a
  // dedicated <VideoEmbed> Preact component that takes a parsed
  // YouTube/Vimeo id, not arbitrary src.
])

/**
 * Tags where we don't want the textContent fallback to leak into the
 * thread when the tag itself is dropped. Without this, the
 * "drop tag, keep text" branch turns `<script>alert(1)</script>` into
 * a visible "alert(1)" message — confusing and useless.
 *
 * The set covers anything that historically smuggles executable code,
 * fingerprinting surface, or layout takeover via inline content,
 * regardless of whether the contemporary parser would actually run
 * it. DOMParser('text/html') is inert (no script execution, no
 * resource loading) so this is defense-in-depth, not a "the script
 * ran" mitigation: dropping the body keeps the thread UI from
 * displaying leaked source as a perceived chat message.
 *
 *   - script / style / noscript: classic JS+CSS escape hatches.
 *   - iframe / object / embed / frame / frameset: nested browsing
 *     contexts; their fallback content (e.g. `<object><script>…</script></object>`)
 *     should not surface either.
 *   - svg / math: foreign-content namespaces where `<script>` and
 *     event-handler attributes are still parseable.
 *   - template: holds an inert document fragment; its serialized
 *     contents are not meaningful chat text.
 *   - link / meta / base: head-only metadata; `<base>` in particular
 *     rewrites every relative URL that follows it.
 *   - form / input / textarea / select / option / button: interactive
 *     widgets posing as chat content; their visible labels can mimic
 *     the host UI.
 */
const SILENT_DROP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'svg',
  'math',
  'template',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'button',
])

/**
 * `style` is intentionally NOT in this set. See the file header for
 * why. `class` is fine because it can only resolve to selectors the
 * widget's own stylesheet defines (no external CSS can target it
 * thanks to the shadow root).
 */
const GLOBAL_ATTRS = new Set(['class'])

const PER_TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
}

/** URL schemes we accept on `href` / `src`. Block javascript:, data:, vbscript:. */
function isSafeUrl(url: string | null): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()
  if (trimmed.startsWith('javascript:')) return false
  if (trimmed.startsWith('vbscript:')) return false
  // Allow only raster image data URLs. SVG-as-data-URL is excluded
  // because it can carry inline `<script>` and event handlers; keep it
  // off the allowlist even though `data:image/svg+xml` matches the
  // `image/` prefix.
  if (trimmed.startsWith('data:')) {
    return /^data:image\/(png|jpe?g|gif|webp|avif);/.test(trimmed)
  }
  return true
}

function cleanElement(el: Element): void {
  const tag = el.tagName.toLowerCase()

  if (!ALLOWED_TAGS.has(tag)) {
    if (SILENT_DROP_TAGS.has(tag)) {
      // Drop the tag *and* its descendants. Without this the parser
      // surfaces the `<script>` body as a text node, which would render
      // as visible text in the bubble — confusing at best, an alarm
      // signal that something was tampered with at worst.
      el.remove()
      return
    }
    // For unknown but innocuous tags (e.g. a Tiptap node we didn't
    // allowlist), keep the text content so the message stays readable.
    const text = el.textContent ?? ''
    el.replaceWith(document.createTextNode(text))
    return
  }

  // Strip disallowed attributes
  const allowed = PER_TAG_ATTRS[tag]
  Array.from(el.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      return
    }
    if (allowed?.has(name) || GLOBAL_ATTRS.has(name)) {
      // Validate URL-bearing attributes
      if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name)
      }
      return
    }
    el.removeAttribute(attr.name)
  })

  // Force-open links in a new tab and prevent reverse-tabnabbing.
  if (tag === 'a') {
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  }

  // Recurse into children (clone to a static array since we mutate)
  Array.from(el.children).forEach((child) => cleanElement(child))
}

/**
 * Returns a sanitized HTML string safe to inject via
 * `dangerouslySetInnerHTML`. Preserves whitespace, drops anything not on
 * the allowlist. Returns empty string on falsy input.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''
  // SSR / pre-mount safety: if there's no DOMParser (shouldn't happen in
  // the widget runtime, but defensive), fall back to empty to avoid
  // shipping unfiltered markup.
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return ''
  }
  const doc = new DOMParser().parseFromString(
    `<div>${input}</div>`,
    'text/html'
  )
  const root = doc.body.firstElementChild
  if (!root) return ''
  Array.from(root.children).forEach((child) => cleanElement(child))
  return root.innerHTML
}
