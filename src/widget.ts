import { ApiClient } from './api/client'
import type { BaseportalChatConfig, ChannelInfo, VisitorData } from './api/types'
import { RealtimeClient } from './realtime/ably-client'
import { getTranslations } from './ui/i18n'
import { mount, unmount, updateTheme } from './ui/mount'
import { EventCallback, EventEmitter } from './utils/events'
import { Storage } from './utils/storage'

const DEFAULT_API_URL = 'https://api.baseportal.io'

export class BaseportalChat {
  private config: Required<
    Pick<BaseportalChatConfig, 'channelToken' | 'apiUrl' | 'position' | 'locale'>
  > &
    BaseportalChatConfig
  private apiClient: ApiClient
  private realtimeClient: RealtimeClient
  private storage: Storage
  private events = new EventEmitter()
  private channelInfo: ChannelInfo | null = null
  private visitor: VisitorData | null = null
  private isAuthenticated = false
  private isOpenRef = { current: false }
  private hidden: boolean
  private mounted = false

  constructor(config: BaseportalChatConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      position: config.position || 'bottom-right',
      locale: config.locale || 'pt',
    }

    this.hidden = config.hideOnLoad || false
    this.visitor = config.visitor || null
    this.isAuthenticated = !!config.visitor?.email

    this.apiClient = new ApiClient(
      this.config.channelToken,
      this.config.apiUrl
    )

    if (this.isAuthenticated && this.visitor?.email) {
      this.apiClient.setVisitorIdentity(this.visitor.email, this.visitor.hash)
    }

    this.storage = new Storage(
      this.config.channelToken,
      this.isAuthenticated ? this.visitor?.email : undefined
    )

    this.realtimeClient = new RealtimeClient(this.apiClient)

    // Restore visitor from storage
    if (!this.visitor) {
      this.visitor = this.storage.getVisitor() || null
    }

    this.init()
  }

  private async init(): Promise<void> {
    try {
      this.channelInfo = await this.apiClient.getChannelInfo()

      // Fire identify *before* mount so the Client record exists by
      // the time the visitor sends their first message — keeps the
      // participant→user binding tight on `getOrCreateChatConversation`.
      // Fire-and-forget: identify failures are intentionally
      // non-fatal so a transient API error or rate-limit doesn't
      // block the widget from rendering.
      void this.maybeIdentify(this.visitor)

      // Apply theme: SDK config > channel theme > default
      const primaryColor =
        this.config.theme?.primaryColor ||
        this.channelInfo.theme?.primaryColor ||
        '#6366f1'

      const t = getTranslations(this.config.locale)

      mount({
        channelInfo: this.channelInfo,
        apiClient: this.apiClient,
        realtimeClient: this.realtimeClient,
        storage: this.storage,
        events: this.events,
        visitor: this.visitor,
        isAuthenticated: this.isAuthenticated,
        position: this.config.position,
        hidden: this.hidden,
        t,
        container: this.config.container,
        isOpenRef: this.isOpenRef,
        setIsOpen: (open: boolean) => {
          this.isOpenRef.current = open
        },
      })

      // Override theme if needed
      if (primaryColor !== '#6366f1') {
        updateTheme(primaryColor)
      }

      this.mounted = true
      this.events.emit('ready')
    } catch (e) {
      console.error('[BaseportalChat] Failed to initialize:', e)
    }
  }

  // --- Visibility ---

  open(): void {
    if (!this.mounted) return
    this.events.emit('_open')
    this.events.emit('open')
  }

  close(): void {
    if (!this.mounted) return
    this.events.emit('_close')
    this.events.emit('close')
  }

  toggle(): void {
    if (this.isOpenRef.current) {
      this.close()
    } else {
      this.open()
    }
  }

  show(): void {
    this.hidden = false
    this.events.emit('show')
  }

  hide(): void {
    this.hidden = true
    this.events.emit('hide')
  }

  isOpen(): boolean {
    return this.isOpenRef.current
  }

  // --- Visitor ---

  identify(visitor: {
    email: string
    name?: string
    phoneNumber?: string
    hash?: string
    ts?: number
    metadata?: Record<string, unknown>
  }): void {
    this.visitor = visitor
    this.isAuthenticated = true
    this.apiClient.setVisitorIdentity(visitor.email, visitor.hash)
    this.storage = new Storage(this.config.channelToken, visitor.email)
    this.storage.setVisitor(visitor)
    this.events.emit('identified', visitor)

    // Sync to the API once identity is updated client-side. Same
    // fire-and-forget contract as the boot path: failures are
    // logged and dropped, the chat keeps working either way.
    void this.maybeIdentify(visitor)

    // Remount with new state
    if (this.mounted) {
      this.remount()
    }
  }

  /**
   * Push updated visitor data to the server. Use this from the
   * embedding app whenever the user's name / phone / custom fields
   * change so the Baseportal Client record stays in sync.
   *
   * For channels with `clientSyncRequiresVerification = true`,
   * generate a fresh `hash` + `ts` server-side per call — v2
   * signatures bind to the timestamp and only stay valid ±10min,
   * so reusing the original `identify()` hash will silently fall
   * through to lookup-only after the window expires.
   *
   * Email is the lookup key and is intentionally NOT updatable here;
   * if the email itself changes, call `identify()` to re-bind.
   *
   * Returns `{ ok: boolean }` so the embedder can surface failures
   * to the user. Resolves `{ ok: false }` and emits no event when:
   *   - sync mode is `off`
   *   - the visitor has no email / phone
   *   - the API call fails (also logged to console)
   */
  async updateVisitor(data: {
    name?: string
    phoneNumber?: string
    metadata?: Record<string, unknown>
    hash?: string
    ts?: number
  }): Promise<{ ok: boolean }> {
    if (!this.visitor) return { ok: false }
    this.visitor = { ...this.visitor, ...data }
    this.storage.setVisitor(this.visitor)

    // Refresh the hash on the api client so the next request carries
    // the fresh signature in `x-visitor-hash`. Only swap when a new
    // hash is provided — older callers passing only fields keep the
    // boot-time hash and degrade to lookup-only after expiry.
    if (data.hash !== undefined && this.visitor.email) {
      this.apiClient.setVisitorIdentity(this.visitor.email, data.hash)
    }

    const result = await this.maybeIdentify(this.visitor)
    if (result.ok) {
      this.events.emit('visitor:updated', this.visitor)
    }
    return result
  }

  /**
   * Pushes the current visitor data to `/identify`. Returns `{ ok }`
   * so awaiting callers (`updateVisitor`) can surface success; boot
   * and `identify()` ignore the promise via `void`.
   *
   * Resolves `{ ok: false }` (no throw) when:
   *  - sync mode is `off`
   *  - no visitor / no usable identifier (email or phone)
   *  - the API call rejects (logged + dropped — non-fatal)
   *
   * The mode filter intentionally stops at `off`: `create` is a valid
   * call too, since the server's VisitorIdentityService no-ops on
   * existing records and creates only on misses. Letting it through
   * keeps the widget oblivious to which mode the channel is in.
   */
  private async maybeIdentify(
    visitor: VisitorData | null
  ): Promise<{ ok: boolean }> {
    if (!this.channelInfo) return { ok: false }
    if (this.channelInfo.config.clientSyncMode === 'off') return { ok: false }
    if (!visitor) return { ok: false }
    if (!visitor.email && !visitor.phoneNumber) return { ok: false }

    try {
      const res = await this.apiClient.identify({
        email: visitor.email,
        phoneNumber: visitor.phoneNumber,
        name: visitor.name,
        metadata: visitor.metadata,
        ts: visitor.ts,
      })
      return { ok: !!res.ok }
    } catch (e) {
      // Non-fatal: the chat keeps working even if the Client record
      // didn't get synced this session.
      console.warn('[BaseportalChat] identify failed:', e)
      return { ok: false }
    }
  }

  clearVisitor(): void {
    this.visitor = null
    this.isAuthenticated = false
    this.apiClient.clearVisitorIdentity()
    this.storage.clear()
    this.storage = new Storage(this.config.channelToken)
    this.realtimeClient.unsubscribe()

    if (this.mounted) {
      this.remount()
    }
  }

  // --- Actions ---

  sendMessage(content: string): void {
    // Implemented via events - App listens
    this.events.emit('_sendMessage', content)
  }

  setConversationId(id: string): void {
    this.events.emit('_setConversationId', id)
  }

  newConversation(): void {
    this.events.emit('_newConversation')
  }

  // --- Config ---

  setTheme(theme: { primaryColor?: string }): void {
    if (theme.primaryColor) {
      updateTheme(theme.primaryColor)
    }
  }

  setPosition(position: 'bottom-right' | 'bottom-left'): void {
    this.config.position = position
    if (this.mounted) {
      this.remount()
    }
  }

  setLocale(locale: 'pt' | 'en' | 'es'): void {
    this.config.locale = locale
    if (this.mounted) {
      this.remount()
    }
  }

  // --- Events ---

  on(event: string, callback: EventCallback): void {
    this.events.on(event, callback)
  }

  off(event: string, callback: EventCallback): void {
    this.events.off(event, callback)
  }

  // --- Lifecycle ---

  destroy(): void {
    this.realtimeClient.unsubscribe()
    this.events.removeAllListeners()
    unmount()
    this.mounted = false
  }

  private remount(): void {
    unmount()
    this.mounted = false
    this.init()
  }
}
