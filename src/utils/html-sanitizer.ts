/**
 * Allowlist-based HTML sanitizer for modal content. Modal HTML comes
 * from the admin TipTap editor and is shipped down to *visitor sites*,
 * which means we never trust the raw markup — a compromised admin
 * account or a TipTap regression could otherwise smuggle <script>,
 * `javascript:` URLs, or inline event handlers onto a third-party domain.
 *
 * Approach: rebuild the DOM from a small allowlist of tags + attrs
 * using `DOMParser`. Anything not on the list is dropped (the text
 * inside is preserved when reasonable). No external dep — modal HTML
 * is bounded to a few KB so a hand-rolled walker is fine.
 *
 * Mirrors the TipTap extensions used by the email/modal editor:
 *   - block: p, div, h1..h3, blockquote, ul, ol, li, hr
 *   - inline: span, strong, em, u, s, br, a, img, button
 * Style attribute is allowed but heavily filtered to layout/typography
 * properties — no `position:fixed`, no url(), no expression(), so a
 * hostile admin can't paint over the host page or smuggle network calls.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'img',
  'button',
  'figure',
  'figcaption',
])

/**
 * Tags whose entire subtree must be discarded (text + descendants).
 * Foreign namespaces (SVG, MathML) host their own attribute models —
 * `<svg><a xlink:href="javascript:...">`, `<svg><foreignObject><iframe>`
 * — that the per-tag allowlist below doesn't reason about. Whitelisting
 * "drop the tag but keep children" leaks malicious children up the
 * tree. The safe move is to silently nuke the entire subtree.
 *
 * Same logic for `<script>`, `<style>`, `<iframe>` and the like —
 * they shouldn't reach this codepath in normal modal content but the
 * defense in depth is cheap.
 */
const SILENT_DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'foreignobject',
  'use',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  // Defense-in-depth additions: not exploitable today (`<noscript>` is
  // neutralised by DOMParser `scripting=off`, `<template>` content
  // lives on `.content` outside `.childNodes`) but any future change
  // to the parsing pipeline could otherwise turn these into a bypass.
  'noscript',
  'template',
  'noembed',
  'frame',
  'frameset',
  // `<image>` is the SVG-namespace twin of `<img>` that bypasses the
  // tag-level allowlist. SVG-animation tags can fetch resources or
  // execute via `<set onbegin="...">` in older parsers.
  'image',
  'animate',
  'set',
])

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  // `rel` is intentionally OFF the allowlist. The attribute-loop
  // below sets `rel=noopener noreferrer` automatically whenever it
  // sees `target` (which is coerced to `_blank`), and a separate
  // backstop fires at the end of the tag walk. Allowing `rel` to ride
  // through the raw HTML opens a reverse-tab-nabbing window: source
  // order `target="_blank" rel="opener"` would let the second
  // assignment overwrite the safe rel value, restoring `window.opener`
  // control to the destination page.
  // `data-link-*` is the content-editor's "click action" model
  // (buttons/text use real `href`/`target`; sections/images can't, so
  // they carry the URL on `data-link-href` + `data-link-target`, and
  // `data-link-type="chat"` signals "open the widget chat panel").
  a: new Set([
    'href',
    'target',
    'style',
    'data-link-type',
    'data-link-href',
    'data-link-target',
  ]),
  img: new Set([
    'src',
    'alt',
    'title',
    'width',
    'height',
    'style',
    'data-link-type',
    'data-link-href',
    'data-link-target',
  ]),
  button: new Set(['data-action', 'data-href', 'style']),
  span: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  div: new Set([
    'style',
    'data-section',
    'data-bg',
    'data-link-type',
    'data-link-href',
    'data-link-target',
  ]),
  p: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h1: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h2: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h3: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h4: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h5: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  h6: new Set(['style', 'data-link-type', 'data-link-href', 'data-link-target']),
  blockquote: new Set(['style']),
  ul: new Set(['style']),
  ol: new Set(['style']),
  li: new Set(['style']),
  figure: new Set([
    'style',
    'data-link-type',
    'data-link-href',
    'data-link-target',
  ]),
  figcaption: new Set(['style']),
}

// Accepted values for `data-link-type` — anything else is dropped (so
// a hand-crafted `data-link-type="javascript"` can't ride through and
// confuse the widget's click handler).
const ALLOWED_LINK_TYPES = new Set(['url', 'chat', 'tel', 'mailto'])

// CSS properties allowed inside `style="..."`. Layout / typography
// only — anything with side-effects (position, transform, animation,
// will-change) or that can fetch resources (background-image,
// list-style-image, content) is dropped.
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'text-align',
  'text-decoration',
  'line-height',
  'letter-spacing',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border',
  'border-radius',
  'border-color',
  'border-width',
  'border-style',
  'width',
  'max-width',
  'min-width',
  'height',
  'max-height',
  'min-height',
  'display',
  'gap',
  'flex',
])

export function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Block protocol-relative URLs (`//evil.com`) — they inherit the
  // host page's protocol and resolve to attacker domains. The earlier
  // regex `/^\//` accepted them because the leading `/` matches.
  if (trimmed.startsWith('//')) return null
  // Block protocol-handler attacks. http/https + relative + mailto/tel
  // + fragment are the only forms we let through; data: / javascript:
  // / vbscript: / file: etc. are rejected because they can re-introduce
  // script execution in `<a href>` or `<img src>`.
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed
  return null
}

function sanitizeStyle(value: string): string {
  // Split on `;` and rebuild — strips `expression(...)` / `url(...)` /
  // anything we don't allow.
  //
  // KNOWN LIMITATION: the substring regex doesn't decode CSS escapes
  // (`\75rl(` is `url(` after the parser runs, `\65xpression(` is
  // `expression(`). Not exploitable today because the allowed
  // properties list (`color`, `font-*`, `padding-*`, `margin-*`,
  // `border*`, `width`, `max-width`, `height`, `display`, `flex`,
  // `gap`) does not include any property whose VALUE makes the
  // browser execute / fetch (no `background-image`, `cursor`,
  // `list-style-image`, `content`, `mask*`). Adding any such property
  // to `ALLOWED_STYLE_PROPS` REQUIRES switching to a real CSS parser
  // (e.g. parsing via a sandboxed `CSSStyleDeclaration`) — the
  // substring check is defense in depth, not the primary control.
  const out: string[] = []
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue
    if (/url\s*\(/i.test(val) || /expression\s*\(/i.test(val) || /javascript:/i.test(val)) continue
    // Also reject backslash-escaped CSS to block `\75rl(` / `\65xpression(`
    // smuggling — cheap belt-and-braces given we strip these properties
    // entirely. If a legitimate value needs `\` (rare in our allowed
    // properties), it gets dropped silently here.
    if (/\\/.test(val)) continue
    out.push(`${prop}: ${val}`)
  }
  return out.join('; ')
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return doc.createTextNode(node.textContent || '')
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return null

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  // Silent-drop list — discard tag + all descendants + text. Used for
  // foreign namespaces (svg, math) whose attribute models bypass our
  // per-tag allowlist, and for executables (`<script>`, `<iframe>`)
  // that should never reach this layer.
  if (SILENT_DROP_TAGS.has(tag)) {
    return null
  }
  if (!ALLOWED_TAGS.has(tag)) {
    // Drop the element but keep its text children where reasonable —
    // a stray <font color> just loses the tag wrapper but leaves the
    // text intact. Anything dangerous is in `SILENT_DROP_TAGS` above.
    const wrap = doc.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const sanitized = sanitizeNode(child, doc)
      if (sanitized) wrap.appendChild(sanitized)
    }
    return wrap
  }

  const clean = doc.createElement(tag)
  const allowedAttrs = ALLOWED_ATTRS_BY_TAG[tag] ?? new Set<string>()

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) continue // event handlers — never.
    if (!allowedAttrs.has(name)) continue
    const raw = attr.value

    if (name === 'href' || name === 'src' || name === 'data-href' || name === 'data-link-href') {
      // tel:/mailto: aren't in the URL allowlist but the editor's
      // image-link feature stores the bare number/address here and the
      // widget's click handler prefixes the scheme — let the bare
      // value through (it's not a navigable URL on its own).
      const isBare = !/[:/]/.test(raw)
      const safe = isBare ? raw : sanitizeUrl(raw)
      if (!safe) continue
      clean.setAttribute(name, safe)
    } else if (name === 'style') {
      const safe = sanitizeStyle(raw)
      if (safe) clean.setAttribute('style', safe)
    } else if (name === 'target' || name === 'data-link-target') {
      // `_self` is safe (no new window, no window.opener); keep it.
      // Anything else (including `_blank`) is normalised to `_blank`,
      // which on a real anchor must pair with `rel=noopener noreferrer`
      // to avoid reverse-tab-nabbing.
      const value = raw === '_self' ? '_self' : '_blank'
      clean.setAttribute(name, value)
      if (name === 'target' && value === '_blank') {
        clean.setAttribute('rel', 'noopener noreferrer')
      }
    } else if (name === 'data-link-type') {
      if (ALLOWED_LINK_TYPES.has(raw)) clean.setAttribute(name, raw)
      // unrecognised → drop (treat as "no link")
    } else {
      clean.setAttribute(name, raw)
    }
  }

  // a[href][target=_blank] without rel — backstop the rel pairing.
  if (tag === 'a' && clean.getAttribute('target') === '_blank' && !clean.hasAttribute('rel')) {
    clean.setAttribute('rel', 'noopener noreferrer')
  }
  // A `data-link-target` only makes sense alongside a `data-link-href`
  // (sections / images carry the URL there). Drop a dangling one.
  if (clean.hasAttribute('data-link-target') && !clean.hasAttribute('data-link-href')) {
    clean.removeAttribute('data-link-target')
  }

  for (const child of Array.from(el.childNodes)) {
    const sanitized = sanitizeNode(child, doc)
    if (sanitized) clean.appendChild(sanitized)
  }
  return clean
}

export function sanitizeModalHtml(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    // SSR / non-browser environment — refuse rather than emit raw HTML.
    return ''
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return ''
  const out = doc.createElement('div')
  for (const child of Array.from(root.childNodes)) {
    const sanitized = sanitizeNode(child, doc)
    if (sanitized) out.appendChild(sanitized)
  }
  return out.innerHTML
}
