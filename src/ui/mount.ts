import { h, render } from 'preact'

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
  notificationSound: boolean
}

let hostElement: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let widgetRoot: HTMLElement | null = null

/**
 * Mounts the widget inside a Shadow DOM root.
 *
 * Why Shadow DOM: the host page (admin panel) ships MUI + Tailwind +
 * its own CSS reset. Without a shadow boundary those bleed into the
 * widget — universal `* { color: ... }` rules at ID-specificity in
 * the host beat any class-level overrides we declare, which is what
 * caused the V1 redesign to render with the wrong text colors and
 * stretched icons. The shadow root cuts the cascade entirely: only
 * styles we explicitly inject reach the widget tree.
 *
 * Trade-offs we live with:
 *   - External portals (e.g. MUI tooltips) cannot inject into the
 *     widget. We don't use any today.
 *   - Custom DOM events fired inside the shadow stop at the boundary
 *     unless `composed: true`. We use a JS EventEmitter (not DOM
 *     events) for `chat.on(...)`, so this is a non-issue.
 *   - `document.body.contains(node)` checks against widget DOM will
 *     fail. None of our utils rely on that pattern.
 */
export function mount(options: MountOptions): void {
  // Host element holds the shadow root and remains a tiny no-op div
  // in the host's layout. Position is `static` + zero size so it
  // doesn't shift the host page; its descendants (bubble/window)
  // use `position: fixed` and live in their own stacking context.
  hostElement = document.createElement('div')
  hostElement.id = 'baseportal-chat-widget'
  hostElement.style.cssText =
    'all: initial; display: block; position: static; width: 0; height: 0;'

  const target = options.container || document.body
  target.appendChild(hostElement)

  shadowRoot = hostElement.attachShadow({ mode: 'open' })

  // Pull Inter from Google Fonts. We do this once per page (the
  // host page's `next/font` self-hosted Inter doesn't reach into
  // the shadow root, and we want the same visual identity as the
  // panel). Skipped silently if the host page already has a link
  // to the same family — duplicate loads are deduped by the
  // browser cache anyway, but a guard keeps the head tidy in HMR.
  injectFontStylesheet()

  // Inject CSS into the shadow root, NOT document.head — the whole
  // point is keeping styles scoped. Constructable stylesheets would
  // be slightly leaner here, but a `<style>` element is universal
  // and avoids the polyfill story for older Safari.
  const styleElement = document.createElement('style')
  styleElement.textContent = widgetCSS
  shadowRoot.appendChild(styleElement)

  // Apply primary color as CSS custom property on the shadow host.
  // CSS variables defined on `:host` propagate into the tree.
  const primaryColor = options.channelInfo.theme?.primaryColor || '#1e4dd8'
  const contrastColor = getContrastColor(primaryColor)
  hostElement.style.setProperty('--bp-primary', primaryColor)
  hostElement.style.setProperty('--bp-primary-contrast', contrastColor)

  // The root that Preact renders into. Lives inside the shadow and
  // carries no host CSS at all.
  widgetRoot = document.createElement('div')
  widgetRoot.className = 'bp-root'
  shadowRoot.appendChild(widgetRoot)

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
      notificationSound: options.notificationSound,
    }),
    widgetRoot
  )
}

export function unmount(): void {
  if (widgetRoot) {
    render(null, widgetRoot)
    widgetRoot = null
  }
  shadowRoot = null
  if (hostElement) {
    hostElement.remove()
    hostElement = null
  }
}

export function updateTheme(primaryColor: string): void {
  if (!hostElement) return
  hostElement.style.setProperty('--bp-primary', primaryColor)
  hostElement.style.setProperty('--bp-primary-contrast', getContrastColor(primaryColor))
}

/**
 * Loads Inter from Google Fonts into `document.head`. Has to be on
 * the parent document — fonts loaded inside a shadow root work, but
 * `@font-face` declared in shadow CSS does NOT propagate. The
 * cleanest cross-browser path is loading at the document level so
 * the font becomes available to every shadow root that references it
 * by name.
 */
function injectFontStylesheet(): void {
  const id = 'baseportal-chat-widget-font'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap'
  document.head.appendChild(link)
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}
