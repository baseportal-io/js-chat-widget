/**
 * Glob-like path matcher used by the visitor-modal targeting rules.
 * Patterns supported:
 *   - exact          /pricing
 *   - prefix wildcard /blog/*    matches /blog/x, /blog/x/y
 *   - segment wildcard /foo/* /bar  (handled by the same `*` token)
 *   - root-only      /
 *   - bare wildcard  *  (matches everything)
 *
 * Case-sensitive. Trailing slashes are normalised away ("/foo/" === "/foo").
 * No regex flavour — admin can't paste a malformed pattern.
 */

function normalizePath(path: string): string {
  if (!path) return '/'
  // strip query / hash if the caller forgot to.
  const noQuery = path.split('?')[0].split('#')[0]
  if (noQuery === '/') return '/'
  return noQuery.endsWith('/') ? noQuery.slice(0, -1) : noQuery
}

function globToRegex(pattern: string): RegExp {
  // escape regex metacharacters EXCEPT `*`, then expand `*` to `[^/]+` in
  // the middle of segments and `.*` when it's the last segment of a
  // prefix-match (the `/blog/*` shape — common case for "everything
  // under /blog").
  const trimmed = normalizePath(pattern)
  if (trimmed === '*') return /^.*$/
  const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  // `/foo/*` → `/foo(/.*)?` — the trailing `*` segment matches "any
  // remaining path". Bare `*` inside a segment matches one segment only.
  let body = escaped.replace(/\\\*/g, '*')
  if (body.endsWith('/*')) {
    body = body.slice(0, -2) + '(?:/.*)?'
  }
  body = body.replace(/\*/g, '[^/]+')
  return new RegExp(`^${body}$`)
}

export function matchAny(path: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) return false
  const normalized = normalizePath(path)
  for (const pat of patterns) {
    try {
      if (globToRegex(pat).test(normalized)) return true
    } catch {
      // bad pattern from server? skip — never throw to the UI.
      continue
    }
  }
  return false
}

/**
 * The plan's targeting rule: include is "allow-list" (empty = all
 * pages); exclude always wins. Both arrays come from the modal config
 * via the visitor channel / pending-modals drain.
 */
export function shouldShowOnPath(
  path: string,
  includePaths: string[],
  excludePaths: string[]
): boolean {
  if (matchAny(path, excludePaths)) return false
  if (!includePaths || includePaths.length === 0) return true
  return matchAny(path, includePaths)
}
