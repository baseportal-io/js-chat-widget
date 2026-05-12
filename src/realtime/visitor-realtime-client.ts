import * as Ably from 'ably'

import type { ApiClient } from '../api/client'

export interface VisitorNotificationPayload {
  text: 'new_message_notification'
  conversationId: string
  messageId: string
  preview: string
  /**
   * First inline image URL from the rich-HTML body of the
   * triggering message, if any. Drives the thumbnail rendered
   * next to the snippet on the floating preview card. Always
   * an http(s) URL — server-side `extractFirstImageUrl` filters
   * out `file://` placeholders.
   */
  previewImageUrl: string | null
  from: {
    name: string | null
    avatarUrl: string | null
  }
  createdAt: string
  source: string | null
  automationId: string | null
  campaignId: string | null
}

export interface ModalPayload {
  id: string
  size: 'small' | 'medium' | 'large' | 'custom'
  customWidth: string | null
  customMaxHeight: string | null
  /**
   * TipTap-rendered HTML body. Images are embedded inline by the
   * builder (uploaded via the file system + a signed URL stamped
   * into the `<img src>`), so the modal does not carry separate
   * hero-image fields.
   */
  content: string | null
  mobileContent: string | null
  includePaths: string[]
  excludePaths: string[]
  /**
   * Display-mode selector that drives the widget UX:
   *   - `until_dismissed` adds a "Não ver mais" link the visitor can
   *     click to permanently opt out of this modal.
   *   - the other modes hide that link (server enforces caps).
   */
  displayMode: 'always' | 'once' | 'until_dismissed' | 'limited'
  /**
   * Inner-card framing — each key is optional; the renderer falls
   * back to defaults when absent. `null` here means "no frame config
   * persisted" → the renderer applies its full default style.
   *
   * `backgroundImageUrl` is resolved server-side at delivery time
   * (see `serializeModalForVisitor` in the API) — the widget receives
   * a fresh signed URL ready to drop into a CSS `url(...)` so legacy
   * deliveries don't break when the original signed link expires.
   */
  frameConfig: {
    backgroundColor?: string
    borderRadius?: number
    borderColor?: string | null
    borderWidth?: number
    padding?: number
    backgroundImageUrl?: string | null
    /** Mobile-only override; the renderer falls back to
     *  `backgroundImageUrl` when null. */
    mobileBackgroundImageUrl?: string | null
  } | null
}

export interface VisitorModalShowPayload {
  text: 'visitor_modal_show'
  deliveryId: string
  modalId: string
  sourceType: 'automation' | 'campaign' | 'manual'
  automationId: string | null
  campaignId: string | null
  modal: ModalPayload
}

export interface VisitorRealtimeHandlers {
  onNotification: (payload: VisitorNotificationPayload) => void
  // Optional so existing call-sites (older host pages bundled with an
  // older widget) compile without forcing every consumer to migrate at once.
  onModalShow?: (payload: VisitorModalShowPayload) => void
}

// Hard caps the widget enforces on every visitor-channel publish.
// PREVIEW_MAX is shorter than the API's own truncation (140 chars on
// the server) so a misbehaving / forged publish can't paint a giant
// preview into the floating card. UUID_MAX_LENGTH is generous enough
// for the Postgres v4 UUIDs we mint but tight enough that a mistyped
// payload doesn't smuggle arbitrary text into a state slot we read
// back later.
const PREVIEW_MAX = 280
const URL_MAX = 1024
const NAME_MAX = 200
const UUID_MAX_LENGTH = 64

function trimToString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  if (value.length === 0) return null
  return value.length > max ? value.slice(0, max) : value
}

function trimToOptionalString(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null
  return trimToString(value, max)
}

/**
 * Validates and clamps a visitor-channel payload before it reaches the
 * UI layer. Returns null when the shape is wrong — the subscriber
 * silently drops malformed publishes (legit producers always send the
 * full schema; a missing field signals a forged or stale payload).
 *
 * Server-side this exact shape is built by `pusher_service.publishToVisitorChannel`,
 * but the channel is also reachable by anyone holding the visitor's
 * token, so we cannot trust the contents blindly. Caps mirror the API's
 * own truncation so a leak of unbounded payload size into the floating
 * preview / unread badge state is impossible from this end.
 */
function normalizeNotification(raw: unknown): VisitorNotificationPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (r.text !== 'new_message_notification') return null

  const conversationId = trimToString(r.conversationId, UUID_MAX_LENGTH)
  const messageId = trimToString(r.messageId, UUID_MAX_LENGTH)
  if (!conversationId || !messageId) return null

  const preview = trimToString(r.preview, PREVIEW_MAX) ?? ''
  const createdAt = trimToString(r.createdAt, 64) ?? new Date().toISOString()

  const fromObj = (r.from && typeof r.from === 'object' ? (r.from as Record<string, unknown>) : {})
  const from = {
    name: trimToOptionalString(fromObj.name, NAME_MAX),
    avatarUrl: trimToOptionalString(fromObj.avatarUrl, URL_MAX),
  }

  // previewImageUrl is optional and clamped to URL_MAX. Reject anything
  // that isn't an http(s) URL so a malicious or stale publish can't
  // paint a `javascript:` / `data:` / opaque-blob URL into the <img>
  // tag the widget renders.
  const rawImage = trimToOptionalString(r.previewImageUrl, URL_MAX)
  const previewImageUrl =
    rawImage && /^https?:\/\//i.test(rawImage) ? rawImage : null

  return {
    text: 'new_message_notification',
    conversationId,
    messageId,
    preview,
    previewImageUrl,
    from,
    createdAt,
    source: trimToOptionalString(r.source, 64),
    automationId: trimToOptionalString(r.automationId, UUID_MAX_LENGTH),
    campaignId: trimToOptionalString(r.campaignId, UUID_MAX_LENGTH),
  }
}

// Bound the modal HTML payload so a forged publish can't smuggle a
// 5MB body through the realtime channel into the widget's render
// path. The admin editor's own size limits are well below this; the
// cap is purely defensive against a malicious / forged sender.
const MODAL_HTML_MAX = 64_000

function normalizeModalShow(raw: unknown): VisitorModalShowPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.text !== 'visitor_modal_show') return null

  const deliveryId = trimToString(r.deliveryId, UUID_MAX_LENGTH)
  const modalId = trimToString(r.modalId, UUID_MAX_LENGTH)
  if (!deliveryId || !modalId) return null

  const m = (r.modal && typeof r.modal === 'object' ? (r.modal as Record<string, unknown>) : null)
  if (!m) return null

  const sizeRaw = trimToOptionalString(m.size, 16) ?? 'medium'
  const size = (['small', 'medium', 'large', 'custom'] as const).includes(sizeRaw as never)
    ? (sizeRaw as 'small' | 'medium' | 'large' | 'custom')
    : 'medium'

  const includePaths = Array.isArray(m.includePaths)
    ? (m.includePaths as unknown[])
        .map((p) => trimToString(p, 255))
        .filter((p): p is string => !!p)
        .slice(0, 50)
    : []
  const excludePaths = Array.isArray(m.excludePaths)
    ? (m.excludePaths as unknown[])
        .map((p) => trimToString(p, 255))
        .filter((p): p is string => !!p)
        .slice(0, 50)
    : []

  const sourceTypeRaw = trimToOptionalString(r.sourceType, 16) ?? 'manual'
  const sourceType = (['automation', 'campaign', 'manual'] as const).includes(
    sourceTypeRaw as never
  )
    ? (sourceTypeRaw as 'automation' | 'campaign' | 'manual')
    : 'manual'

  const displayModeRaw = trimToOptionalString(m.displayMode, 32) ?? 'always'
  const displayMode = (
    ['always', 'once', 'until_dismissed', 'limited'] as const
  ).includes(displayModeRaw as never)
    ? (displayModeRaw as 'always' | 'once' | 'until_dismissed' | 'limited')
    : 'always'

  // Frame config — small object of optional styling tokens. Validated
  // light because the keys are CSS values and overspecifying breaks
  // forward-compat. Numbers clamped to a sane range so a malformed
  // publish can't paint a 99999px-radius card. Colors stay strings
  // (hex / rgb() / `transparent`) and only have a length cap to keep
  // the payload tight.
  const frameConfig = ((): ModalPayload['frameConfig'] => {
    const fc = m.frameConfig
    if (!fc || typeof fc !== 'object') return null
    const f = fc as Record<string, unknown>
    const clamp = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, n))
    const out: NonNullable<ModalPayload['frameConfig']> = {}
    const bg = trimToOptionalString(f.backgroundColor, 64)
    if (bg) out.backgroundColor = bg
    const bc = trimToOptionalString(f.borderColor, 64)
    if (bc !== undefined) out.borderColor = bc
    if (typeof f.borderRadius === 'number') {
      out.borderRadius = clamp(f.borderRadius, 0, 64)
    }
    if (typeof f.borderWidth === 'number') {
      out.borderWidth = clamp(f.borderWidth, 0, 16)
    }
    if (typeof f.padding === 'number') {
      out.padding = clamp(f.padding, 0, 64)
    }
    // Cap at 4 KB so a forged publish can't smuggle a giant string
    // into the visitor channel; legitimate signed-URLs come well
    // under that.
    const bgImage = trimToOptionalString(f.backgroundImageUrl, 4096)
    if (bgImage) out.backgroundImageUrl = bgImage
    const mobileBgImage = trimToOptionalString(f.mobileBackgroundImageUrl, 4096)
    if (mobileBgImage) out.mobileBackgroundImageUrl = mobileBgImage
    return Object.keys(out).length > 0 ? out : null
  })()

  return {
    text: 'visitor_modal_show',
    deliveryId,
    modalId,
    sourceType,
    automationId: trimToOptionalString(r.automationId, UUID_MAX_LENGTH),
    campaignId: trimToOptionalString(r.campaignId, UUID_MAX_LENGTH),
    modal: {
      id: modalId,
      size,
      customWidth: trimToOptionalString(m.customWidth, 32),
      customMaxHeight: trimToOptionalString(m.customMaxHeight, 32),
      content: trimToOptionalString(m.content, MODAL_HTML_MAX),
      mobileContent: trimToOptionalString(m.mobileContent, MODAL_HTML_MAX),
      includePaths,
      excludePaths,
      displayMode,
      frameConfig,
    },
  }
}

/**
 * Subscribes to the visitor's per-contact notification channel
 * (`visitor-{contactId}` server-side) so the widget shell can react to
 * messages that arrive in conversations the visitor isn't actively
 * subscribed to. Lives at the widget shell level, not inside
 * ChatWindow — it's active for the whole widget lifetime regardless
 * of which view (home / messages / chat) is on screen.
 *
 * Distinct from `RealtimeClient` (which subscribes per-conversation
 * for the open chat thread) because the two have different lifetimes
 * and capabilities. The conversation-scoped client only sees
 * `created_or_updated_message` for its single thread; this one sees
 * `new_message_notification` for *every* conversation the contact is
 * a participant on.
 *
 * Errors during token fetch or connect are silently dropped — the
 * widget keeps working without notifications, which is strictly worse
 * UX but never fatal. A 401 means the visitor hasn't been identified
 * yet (or identity verification rejected the hash); subsequent
 * `connect` calls retry automatically.
 */
export class VisitorRealtimeClient {
  private client: Ably.Realtime | null = null
  private channel: Ably.RealtimeChannel | null = null
  private apiClient: ApiClient
  private handlers: VisitorRealtimeHandlers | null = null

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  async connect(handlers: VisitorRealtimeHandlers): Promise<void> {
    // Idempotent connect — if we're already subscribed, just swap
    // handlers (the parent re-renders with new closures every visitor
    // refresh, and we don't want to drop+re-create the connection on
    // every team switch).
    this.handlers = handlers
    if (this.client && this.channel) return

    let tokenRequest: Ably.TokenRequest
    try {
      tokenRequest = (await this.apiClient.getVisitorAblyToken()) as Ably.TokenRequest
    } catch (tokenErr) {
      // Visitor not identified yet, or verification failed. We log
      // (not warn) so the dev console explains why notifications might
      // be quiet — without this it looked like silent failure when in
      // fact the contact just hadn't been minted yet by /identify.
      // Subsequent calls (triggered by `identify-success`) will retry.
      console.info(
        '[BaseportalChat] visitor token unavailable, retrying after identify',
        tokenErr
      )
      return
    }

    try {
      this.client = new Ably.Realtime({
        authCallback: (_data, callback) => {
          callback(null, tokenRequest)
        },
        clientId: tokenRequest.clientId ?? undefined,
      })

      // The channel name is encoded in the token capability — Ably
      // returns the granted channel set under `capability` as a
      // JSON-string keyed object like `{"visitor-<uuid>":["subscribe"]}`.
      // We read the first key off it instead of taking a raw name from
      // the caller, so the widget can never accidentally subscribe to
      // a channel the API didn't authorize.
      const granted = JSON.parse(tokenRequest.capability ?? '{}') as Record<
        string,
        unknown
      >
      const channelName = Object.keys(granted)[0]
      if (!channelName) {
        console.warn(
          '[BaseportalChat] visitor token has no channel capability — skipping subscribe'
        )
        return
      }

      this.channel = this.client.channels.get(channelName)
      // Explicit attach so we know early whether the subscription is
      // actually alive — without it, a misbehaving token / capability
      // would only surface when an expected publish never arrives. The
      // `attached` event log lets users confirm wiring in dev.
      this.channel.once('attached', () => {
        console.info(
          `[BaseportalChat] visitor realtime: subscribed to ${channelName}`
        )
      })
      this.channel.once('failed', (stateChange: unknown) => {
        console.warn(
          `[BaseportalChat] visitor realtime: channel failed`,
          stateChange
        )
      })
      this.channel.subscribe('notification', (msg) => {
        if (!msg.data || !this.handlers) return
        try {
          const raw =
            typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data
          // The visitor channel multiplexes notification kinds via the
          // `text` discriminator: chat messages use
          // `new_message_notification`, modals use `visitor_modal_show`.
          // Route by `text` so a future kind doesn't accidentally hit
          // the floating-preview path.
          if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).text === 'visitor_modal_show') {
            const modal = normalizeModalShow(raw)
            if (modal && this.handlers.onModalShow) {
              this.handlers.onModalShow(modal)
            }
            return
          }
          const payload = normalizeNotification(raw)
          if (payload) {
            this.handlers.onNotification(payload)
          }
        } catch (parseErr) {
          console.warn(
            '[BaseportalChat] visitor realtime: malformed payload',
            parseErr
          )
        }
      })
      void this.channel.attach()
    } catch (e) {
      console.warn('[BaseportalChat] visitor realtime connect failed:', e)
    }
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    if (this.client) {
      this.client.close()
      this.client = null
    }
    this.handlers = null
  }
}
