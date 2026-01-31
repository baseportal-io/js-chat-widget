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
    hash: string
    metadata?: Record<string, string>
  }): void {
    this.visitor = visitor
    this.isAuthenticated = true
    this.apiClient.setVisitorIdentity(visitor.email, visitor.hash)
    this.storage = new Storage(this.config.channelToken, visitor.email)
    this.storage.setVisitor(visitor)
    this.events.emit('identified', visitor)

    // Remount with new state
    if (this.mounted) {
      this.remount()
    }
  }

  updateVisitor(data: {
    name?: string
    metadata?: Record<string, string>
  }): void {
    if (this.visitor) {
      this.visitor = { ...this.visitor, ...data }
      this.storage.setVisitor(this.visitor)
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
