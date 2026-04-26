/**
 * Renders WhatsApp-style markdown to safe HTML.
 *
 * Supported markers (mirror what the AI agent emits):
 *   *bold*           → <strong>bold</strong>
 *   _italic_         → <em>italic</em>
 *   ~strike~         → <s>strike</s>
 *   `inline code`    → <code>inline code</code>
 *   ```block code``` → <pre><code>block code</code></pre>
 *   https://...      → <a target="_blank" rel="noopener">…</a>
 *
 * The boundary requirements (`(^|\W)` before, `(\W|$)` after) avoid eating
 * stars/underscores that are part of normal text — e.g. `2*3*4`, file
 * paths, snake_case identifiers — only treating them as formatting when
 * the markers sit at word edges.
 *
 * Output is intended for use with `dangerouslySetInnerHTML`. Input is
 * escaped first so the agent (or anyone else) cannot inject raw HTML
 * by sending `<script>` etc.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function whatsappToHtml(text: string): string {
  if (!text) return ''

  let html = escapeHtml(text)

  // Code blocks first (so we don't double-process the contents).
  html = html.replace(
    /```([\s\S]+?)```/g,
    (_m, body) => `<pre><code>${body}</code></pre>`
  )

  // Inline code.
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // Bold *text*. Boundary on both sides keeps `2*3*4` literal.
  html = html.replace(
    /(^|\W)\*([^\s*][^*\n]*?)\*(?=\W|$)/g,
    '$1<strong>$2</strong>'
  )

  // Italic _text_. Same boundary rule — protects snake_case.
  html = html.replace(/(^|\W)_([^\s_][^_\n]*?)_(?=\W|$)/g, '$1<em>$2</em>')

  // Strikethrough ~text~.
  html = html.replace(/(^|\W)~([^\s~][^~\n]*?)~(?=\W|$)/g, '$1<s>$2</s>')

  // Auto-link plain URLs. Skip ones already inside an href (basic guard).
  html = html.replace(
    /(^|[^"'>=])(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  )

  return html
}
