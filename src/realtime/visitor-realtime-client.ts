import * as Ably from 'ably'

import type { ApiClient } from '../api/client'

export interface VisitorNotificationPayload {
  text: 'new_message_notification'
  conversationId: string
  messageId: string
  preview: string
  from: {
    name: string | null
    avatarUrl: string | null
  }
  createdAt: string
  source: string | null
  automationId: string | null
}

export interface VisitorRealtimeHandlers {
  onNotification: (payload: VisitorNotificationPayload) => void
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

  return {
    text: 'new_message_notification',
    conversationId,
    messageId,
    preview,
    from,
    createdAt,
    source: trimToOptionalString(r.source, 64),
    automationId: trimToOptionalString(r.automationId, UUID_MAX_LENGTH),
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
