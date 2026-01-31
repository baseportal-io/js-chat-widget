import { render, h } from 'preact'

import type { ApiClient } from '../api/client'
import type { ChannelInfo, VisitorData } from '../api/types'
import type { RealtimeClient } from '../realtime/ably-client'
import type { EventEmitter } from '../utils/events'
import type { Storage } from '../utils/storage'
import { App } from './App'
import type { Translations } from './i18n'
import widgetCSS from './styles/widget-css'

interface MountOptions {
  channelInfo: ChannelInfo
  apiClient: ApiClient
  realtimeClient: RealtimeClient
  storage: Storage
  events: EventEmitter
  visitor: VisitorData | null
  isAuthenticated: boolean
  position: 'bottom-right' | 'bottom-left'
  hidden: boolean
  t: Translations
  container?: HTMLElement
  isOpenRef: { current: boolean }
  setIsOpen: (open: boolean) => void
}

let styleElement: HTMLStyleElement | null = null
let hostElement: HTMLElement | null = null

export function mount(options: MountOptions): void {
  // Inject styles into document head (once)
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'baseportal-chat-styles'
    styleElement.textContent = widgetCSS
    document.head.appendChild(styleElement)
  }

  // Create host element directly on body — no shadow DOM
  hostElement = document.createElement('div')
  hostElement.id = 'baseportal-chat-widget'
  const target = options.container || document.body
  target.appendChild(hostElement)

  // Apply primary color as CSS variable
  const primaryColor =
    options.channelInfo.theme?.primaryColor || '#6366f1'
  const contrastColor = getContrastColor(primaryColor)
  hostElement.style.setProperty('--bp-primary', primaryColor)
  hostElement.style.setProperty('--bp-primary-contrast', contrastColor)

  // Render Preact app
  render(
    h(App, {
      channelInfo: options.channelInfo,
      apiClient: options.apiClient,
      realtimeClient: options.realtimeClient,
      storage: options.storage,
      events: options.events,
      visitor: options.visitor,
      isAuthenticated: options.isAuthenticated,
      position: options.position,
      hidden: options.hidden,
      t: options.t,
      isOpenRef: options.isOpenRef,
      setIsOpen: options.setIsOpen,
    }),
    hostElement
  )
}

export function unmount(): void {
  if (hostElement) {
    render(null, hostElement)
    hostElement.remove()
    hostElement = null
  }
  if (styleElement) {
    styleElement.remove()
    styleElement = null
  }
}

export function updateTheme(primaryColor: string): void {
  if (!hostElement) return
  hostElement.style.setProperty('--bp-primary', primaryColor)
  hostElement.style.setProperty(
    '--bp-primary-contrast',
    getContrastColor(primaryColor)
  )
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance =
    (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}
