/**
 * Tiny logger gated on `BaseportalChatConfig.debug`. We don't want
 * the widget polluting embedders' production consoles, but the
 * warnings are still useful for support — flip the flag on, repro,
 * send the trace. Components import { warn } from this file instead
 * of calling console directly.
 *
 * State is module-local because the SDK is a singleton in practice
 * (one BaseportalChat instance per page). If embedders ever start
 * mounting two widgets on the same page with different debug
 * settings, this needs to thread the config through props.
 */
let debugEnabled = false

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled
}

export function warn(...args: unknown[]): void {
  if (!debugEnabled) return
  // eslint-disable-next-line no-console
  console.warn('[BaseportalChat]', ...args)
}

export function error(...args: unknown[]): void {
  // Errors always log — these mean something is broken and the
  // embedder needs the signal even without `debug: true`.
  // eslint-disable-next-line no-console
  console.error('[BaseportalChat]', ...args)
}
