/** @jsxImportSource preact */

import { useEffect, useMemo, useState } from 'preact/hooks'

import type { ModalPayload } from '../../realtime/visitor-realtime-client'
import { sanitizeModalHtml } from '../../utils/html-sanitizer'

const MOBILE_BREAKPOINT_PX = 768

/**
 * Allow only http(s) URLs in the bg-image CSS. The server already
 * mints these as signed Cloudflare URLs, but a misconfigured / forged
 * publish could smuggle a third-party tracker
 * (`https://tracker.attacker/pixel.png?id=...`) that leaks visitor
 * IP / UA / Referer when the browser fetches it. Cap to 4 KB to
 * match the realtime-payload validator and avoid pathological URLs.
 */
function sanitizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('//')) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  // Reject any character that would break out of the CSS `url("…")`
  // wrapper (newlines, `"`, `\`). Legitimate signed URLs never use them.
  if (/["\\\n\r]/.test(trimmed)) return null
  return trimmed.length > 4096 ? null : trimmed
}

/**
 * Predefined sizes — width is fixed, height is variant-specific so a
 * single preset stays usable on both desktop and mobile.
 *
 *  - `desktopHeight`: landscape proportion (~3:2 width:height ratio)
 *    so the card reads as "horizontal" on a big monitor. Pure `vh`
 *    made a 600-wide medium card 1080+ px tall on a 1440p screen —
 *    landscape preset rendered as portrait. The px cap fixes that.
 *  - `mobileHeight`: portrait proportion (taller than wide) — the
 *    width is also clamped to `calc(100vw - 32px)` below, so on a
 *    phone the card naturally fills most of the screen vertically,
 *    matching the visual rhythm of native mobile sheets.
 *
 * `min(vh, px)` keeps both variants behaving on short viewports —
 * the `vh` term dominates when the screen is too short for the px
 * cap (small laptops, landscape phones).
 *
 * Content longer than the configured height scrolls inside the card;
 * the close button stays on the outer frame so it never scrolls away.
 */
const SIZE_PRESETS: Record<
  'small' | 'medium' | 'large',
  { width: string; desktopHeight: string; mobileHeight: string }
> = {
  small: {
    width: '400px',
    desktopHeight: 'min(60vh, 270px)',
    mobileHeight: 'min(70vh, 480px)',
  },
  medium: {
    width: '600px',
    desktopHeight: 'min(70vh, 400px)',
    mobileHeight: 'min(75vh, 600px)',
  },
  large: {
    width: '800px',
    desktopHeight: 'min(80vh, 540px)',
    mobileHeight: 'min(85vh, 700px)',
  },
}

interface VisitorModalProps {
  modal: ModalPayload
  onDismiss: () => void
  /**
   * Permanent opt-out for `displayMode === 'until_dismissed'`. The
   * widget renders a "Não ver mais" link only when this prop AND the
   * matching mode are present. Host shell posts an `opt_out` event so
   * the backend flips `permanently_dismissed` on the delivery row,
   * blocking every future delivery of this modal to this visitor.
   */
  onOptOut?: () => void
  // Preview mode renders inline (no fixed positioning, no backdrop) so
  // the admin editor can embed the same component inside an iframe and
  // get a faithful render. Hidden from postbacks too — preview should
  // never count toward `shown_at`.
  previewMode?: boolean
  forceVariant?: 'desktop' | 'mobile'
}

function useViewport(forceVariant?: 'desktop' | 'mobile'): 'desktop' | 'mobile' {
  const initial: 'desktop' | 'mobile' =
    forceVariant ??
    (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
      ? 'mobile'
      : 'desktop')
  const [variant, setVariant] = useState<'desktop' | 'mobile'>(initial)

  useEffect(() => {
    if (forceVariant) {
      setVariant(forceVariant)
      return
    }
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setVariant(e.matches ? 'mobile' : 'desktop')
    handler({ matches: mql.matches } as MediaQueryListEvent)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [forceVariant])

  return variant
}

export function VisitorModal({
  modal,
  onDismiss,
  onOptOut,
  previewMode,
  forceVariant,
}: VisitorModalProps) {
  const variant = useViewport(forceVariant)

  // Pick mobile content when on mobile and the override is set; fall
  // back to desktop content otherwise.
  const html = useMemo(() => {
    const raw =
      variant === 'mobile' && modal.mobileContent ? modal.mobileContent : modal.content || ''
    const sanitized = sanitizeModalHtml(raw)
    // Diagnostic: when the input had content but everything got
    // sanitized away, surface it so the host page's devtools shows
    // what's happening. The modal itself still renders (we add a
    // visible empty-state card below) but the admin needs to know
    // their content was rejected.
    if (raw.trim().length > 0 && sanitized.trim().length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[BaseportalChat] modal content was empty after sanitization — check for unsupported tags',
        { modalId: modal.id, rawLength: raw.length }
      )
    }
    return sanitized
  }, [modal.content, modal.mobileContent, modal.id, variant])

  // ESC dismissal — standard accessibility expectation. Disabled in
  // previewMode so the admin can interact with the iframe without
  // losing the render.
  useEffect(() => {
    if (previewMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [previewMode, onDismiss])

  // `size` is the only knob — the modal is always a content card.
  // Custom dims override presets when both are set; otherwise fall
  // through to the matching preset and ultimately to medium. The
  // height is definite (`height`, not `max-height`) so a card with
  // only a background image fills the configured height instead of
  // collapsing to the close button only. Height switches between
  // landscape (desktop) and portrait (mobile) — see SIZE_PRESETS.
  const dimensions = useMemo(() => {
    if (modal.size === 'custom' && (modal.customWidth || modal.customMaxHeight)) {
      return {
        width: modal.customWidth ?? '600px',
        // Custom height honours whatever the admin typed verbatim.
        // When blank we fall back to the medium preset for the
        // current variant so a `custom` card with only a custom
        // width inherits the same landscape/portrait switch the
        // presets get.
        height:
          modal.customMaxHeight ??
          (variant === 'mobile'
            ? SIZE_PRESETS.medium.mobileHeight
            : SIZE_PRESETS.medium.desktopHeight),
      }
    }
    const preset =
      SIZE_PRESETS[modal.size as 'small' | 'medium' | 'large'] ?? SIZE_PRESETS.medium
    return {
      width: preset.width,
      height: variant === 'mobile' ? preset.mobileHeight : preset.desktopHeight,
    }
  }, [modal.size, modal.customWidth, modal.customMaxHeight, variant])

  // Mobile clamp: never exceed (100vw - 32px) regardless of preset, so
  // a small phone doesn't push the card off-screen on the right.
  const widthCss =
    variant === 'mobile'
      ? `min(${dimensions.width}, calc(100vw - 32px))`
      : dimensions.width

  const containerStyle: Record<string, string> = previewMode
    ? {
        position: 'relative',
        width: widthCss,
        height: dimensions.height,
        margin: '0 auto',
      }
    : {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483646', // one below the FAB so chat opens on top.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
      }

  // Frame config drives the inner card's bg / radius / border / image
  // / padding. Each token has a sensible default so a modal saved
  // before frame_config existed (or saved with a partial config) still
  // renders cleanly.
  const fc = modal.frameConfig ?? {}
  const frameBg = fc.backgroundColor ?? '#ffffff'
  const frameRadius = typeof fc.borderRadius === 'number' ? `${fc.borderRadius}px` : '16px'
  const frameBorder =
    fc.borderColor && typeof fc.borderWidth === 'number' && fc.borderWidth > 0
      ? `${fc.borderWidth}px solid ${fc.borderColor}`
      : 'none'
  const framePadding = typeof fc.padding === 'number' ? `${fc.padding}px` : '24px'
  // Mobile override: when on a mobile viewport AND a mobile image is
  // set, prefer it; otherwise fall back to the desktop image. Same
  // shape as the content / mobileContent fallback above so admins get
  // consistent semantics across the two slot pairs.
  const activeBgImageUrl =
    variant === 'mobile' && fc.mobileBackgroundImageUrl
      ? fc.mobileBackgroundImageUrl
      : fc.backgroundImageUrl
  // Re-validate the URL on the widget side even though the server
  // already resolved it through signed-URL minting — a compromised
  // admin or token holder could have stamped a third-party tracking
  // pixel ("https://tracker.attacker/...?id=..."). The sanitizer
  // rejects protocol-relative + non-http schemes; anything else is
  // a legitimate Cloudflare-signed delivery URL. Falling back to
  // `none` is the safe failure mode — visitor sees the modal
  // without the bg image instead of leaking IP/UA/Referer.
  const safeBgImageUrl = activeBgImageUrl
    ? sanitizeImageUrl(activeBgImageUrl)
    : null
  const frameBgImage = safeBgImageUrl ? `url("${safeBgImageUrl}")` : 'none'

  // Outer card: definite height + `overflow: hidden` so the bg image
  // is clipped to the rounded corners and the absolute close button
  // stays in place when the inner content scrolls.
  const innerStyle: Record<string, string> = {
    position: 'relative',
    width: widthCss,
    height: dimensions.height,
    // Mobile safety: never exceed (100vh - 32px) so a tall preset on a
    // short viewport doesn't push the card off-screen vertically.
    maxHeight: 'calc(100vh - 32px)',
    background: frameBg,
    backgroundImage: frameBgImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    borderRadius: frameRadius,
    border: frameBorder,
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  }

  // Inner content area: fills the remaining height inside the frame,
  // scrolls when content exceeds the height. The close button sits
  // outside this scroll container so it stays visible at all times.
  const contentScrollStyle: Record<string, string> = {
    flex: '1',
    minHeight: '0',
    overflow: 'auto',
    padding: framePadding,
  }

  const placeholderStyle: Record<string, string> = {
    color: '#94a3b8',
    fontSize: '13px',
    textAlign: 'center',
    padding: '16px',
  }

  const closeButtonStyle: Record<string, string> = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#0f172a',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2',
  }

  // Only show the "don't show again" link when the modal is configured
  // for the until_dismissed display mode AND the host wired up an
  // `onOptOut` handler (preview mode skips the link — admins shouldn't
  // be able to opt themselves out of their own draft).
  const showOptOut =
    !previewMode && !!onOptOut && modal.displayMode === 'until_dismissed'

  const optOutStyle: Record<string, string> = {
    display: 'inline-block',
    marginTop: '12px',
    padding: '4px 8px',
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '12px',
  }

  const onBackdropClick = (e: MouseEvent) => {
    if (previewMode) return
    if (e.target === e.currentTarget) onDismiss()
  }

  const hasContent = html.trim().length > 0

  return (
    <div style={containerStyle} onClick={onBackdropClick} role="dialog" aria-modal="true">
      <div style={innerStyle}>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          style={closeButtonStyle}
        >
          ×
        </button>
        <div style={contentScrollStyle}>
          {hasContent ? (
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ color: '#0f172a', fontSize: '15px', lineHeight: '1.6' }}
            />
          ) : !frameBgImage || frameBgImage === 'none' ? (
            // Empty modal AND no bg image — sanitizer dropped everything
            // OR admin saved with no body. Surfaces a recognisable card
            // so visitors don't see "just an X button" and devtools gets
            // the warn from the sanitizer above. When a bg image IS set,
            // we skip this placeholder: the image alone is a valid
            // "image-first" modal layout (e.g. a banner).
            <div style={placeholderStyle}>Conteúdo indisponível</div>
          ) : null}
          {showOptOut && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={onOptOut} style={optOutStyle}>
                Não ver mais
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
