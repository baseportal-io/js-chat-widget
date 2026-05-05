/** @jsxImportSource preact */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import type { ApiClient } from '../api/client'
import type { ChannelInfo, Message, VisitorData } from '../api/types'
import type { RealtimeClient } from '../realtime/ably-client'
import {
  VisitorRealtimeClient,
  type VisitorNotificationPayload,
} from '../realtime/visitor-realtime-client'
import type { EventEmitter } from '../utils/events'
import { playNotificationSound } from '../utils/notification-sound'
import type { Storage } from '../utils/storage'
import { ChatBubble } from './components/ChatBubble'
import { ChatWindow } from './components/ChatWindow'
import {
  FloatingPreview,
  notificationToPreview,
  type PendingPreview,
} from './components/FloatingPreview'
import type { Translations } from './i18n'

// Hard ceiling on stacked preview cards. The FloatingPreview only
// renders the top N anyway, but keeping the array unbounded would let
// memory grow on a long-lived tab.
const MAX_PREVIEWS = 20

interface AppProps {
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
  // Controlled state from widget class
  isOpenRef: { current: boolean }
  setIsOpen: (open: boolean) => void
  notificationSound: boolean
}

export function App({
  channelInfo,
  apiClient,
  realtimeClient,
  storage,
  events,
  visitor,
  isAuthenticated,
  position,
  hidden,
  t,
  isOpenRef,
  setIsOpen,
  notificationSound,
}: AppProps) {
  const [isOpen, setIsOpenState] = useState(isOpenRef.current)
  const [isHidden, setIsHidden] = useState(hidden)
  const [unreadCount, setUnreadCount] = useState(0)
  const [previews, setPreviews] = useState<PendingPreview[]>([])
  // Seed for ChatWindow when it first mounts: jumps the user straight
  // into the conversation they came from (preview click). Read once on
  // remount; not used to track the currently-viewed conversation.
  const [initialConvId, setInitialConvId] = useState<string | null>(null)
  const visitorRealtimeRef = useRef<VisitorRealtimeClient | null>(null)

  // Refs that mirror the latest state so handlers attached once at
  // mount can read fresh values without re-creating the Ably
  // subscription on every render. Without these the
  // `client.connect(...)` closure captured the initial values and
  // never observed updates — duplicate banners + sound on a
  // conversation the user was already viewing.
  //
  // `viewingConvIdRef` is driven by `conversation:viewing` events from
  // ChatWindow (entering/leaving the chat view, switching between
  // threads). Decoupled from `initialConvId` because that state only
  // captures the *seed* — once the user navigates within the widget,
  // it goes stale and would suppress notifications for the wrong
  // thread.
  const viewingConvIdRef = useRef<string | null>(null)
  const notificationSoundRef = useRef(notificationSound)
  notificationSoundRef.current = notificationSound

  // Listen for external open/close/show/hide from SDK
  useEffect(() => {
    const onOpen = () => {
      setIsOpenState(true)
      isOpenRef.current = true
      setIsOpen(true)
    }
    const onClose = () => {
      setIsOpenState(false)
      isOpenRef.current = false
      setIsOpen(false)
    }
    const onShow = () => setIsHidden(false)
    const onHide = () => {
      setIsHidden(true)
      setIsOpenState(false)
      isOpenRef.current = false
      setIsOpen(false)
    }

    events.on('_open', onOpen)
    events.on('_close', onClose)
    events.on('show', onShow)
    events.on('hide', onHide)

    return () => {
      events.off('_open', onOpen)
      events.off('_close', onClose)
      events.off('show', onShow)
      events.off('hide', onHide)
    }
  }, [events, isOpenRef, setIsOpen])

  // Notification sound on inbound messages from the *currently open*
  // conversation. Visitor echoes (`role === 'client'`) are suppressed
  // — playing back to the sender after they hit send is just noise.
  // Cross-conversation messages don't reach this handler (ChatWindow's
  // RealtimeClient is per-conversation); those are handled by the
  // visitor-channel subscription below.
  useEffect(() => {
    if (!notificationSound) return
    const onMessage = (msg: Message) => {
      if (!msg || msg.role === 'client') return
      const widgetActive =
        isOpenRef.current &&
        typeof document !== 'undefined' &&
        document.hasFocus() &&
        document.visibilityState === 'visible'
      playNotificationSound({ isWidgetActive: widgetActive })
    }
    events.on('message:received', onMessage)
    return () => {
      events.off('message:received', onMessage)
    }
  }, [events, isOpenRef, notificationSound])

  // Reset the unread badge when the widget opens. Same UX as Intercom
  // / Slack — opening the surface clears the count. Also drop the
  // currently-viewed conversation id when the widget closes — once
  // ChatWindow unmounts there's nothing being viewed.
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
    } else {
      viewingConvIdRef.current = null
      // Reset the seed too so the next open doesn't bounce back into
      // a stale conversation the user already left.
      setInitialConvId(null)
    }
  }, [isOpen])

  // Track which conversation the user is currently viewing inside the
  // widget. ChatWindow emits this on every entry/exit/swap of the chat
  // view; without it, navigating from convo A to convo B left the ref
  // stuck on A and silently dropped notifications for B.
  useEffect(() => {
    const onViewing = (convId: string | null) => {
      viewingConvIdRef.current = convId
    }
    events.on('conversation:viewing', onViewing)
    return () => {
      events.off('conversation:viewing', onViewing)
    }
  }, [events])

  // Visitor-scoped realtime: subscribes to `visitor-{contactId}` so we
  // can react to messages on conversations the visitor isn't actively
  // viewing — drives the FloatingPreview, the cross-conversation
  // notification sound, and the FAB unread badge. Distinct from
  // `realtimeClient` (per-conversation, owned by ChatWindow) because
  // it lives at the shell level, alive for the whole widget lifetime.
  //
  // First connect attempt is eager (silently no-ops with 401 if the
  // visitor hasn't been identified yet); the `identify-success`
  // listener retries once the API confirms the contact mirror exists.
  useEffect(() => {
    const client = new VisitorRealtimeClient(apiClient)
    visitorRealtimeRef.current = client

    const handlers = {
      onNotification: (payload: VisitorNotificationPayload) => {
        // Suppress preview / unread-bump when the visitor is already
        // viewing this exact conversation — the per-conversation
        // subscription has surfaced the bubble there already.
        const viewingThisConvo =
          isOpenRef.current && viewingConvIdRef.current === payload.conversationId

        if (!viewingThisConvo) {
          // Cap the unread badge — the FAB has finite room and a
          // misbehaving / hostile producer (anyone holding the visitor
          // token) could otherwise flood the counter into bizarre
          // territory ("9999+ messages"). 99 is the conventional ceiling.
          setUnreadCount((c) => Math.min(99, c + 1))
          setPreviews((prev) => {
            // Dedupe by messageId — Ably sometimes redelivers on
            // resume; better to ignore duplicates than stack two cards.
            if (prev.some((p) => p.id === payload.messageId)) return prev
            // Cap the preview stack — dedupe alone doesn't bound growth
            // when payloads arrive with unique messageIds (legitimate
            // long burst OR a flood from a forged token holder). FIFO
            // drop the oldest so the most recent context wins.
            const next = [...prev, notificationToPreview(payload)]
            return next.length > MAX_PREVIEWS ? next.slice(-MAX_PREVIEWS) : next
          })
        }

        // Sound gated on tab/focus so a backgrounded tab doesn't
        // chime on every drip-campaign step. We don't gate on
        // `isOpen` here — the user might be on a different page in
        // the same tab with the FAB visible; the chime is the only
        // signal that something happened.
        if (notificationSoundRef.current) {
          const tabActive =
            typeof document !== 'undefined' &&
            document.hasFocus() &&
            document.visibilityState === 'visible'
          playNotificationSound({ isWidgetActive: tabActive })
        }
      },
    }

    void client.connect(handlers)

    // Retry once identify completes server-side. `connect` is
    // idempotent — short-circuits when an Ably subscription is
    // already live, so safe to invoke on the happy path too.
    const onIdentified = () => {
      void client.connect(handlers)
    }
    events.on('identify-success', onIdentified)

    return () => {
      events.off('identify-success', onIdentified)
      client.disconnect()
      visitorRealtimeRef.current = null
    }
  }, [apiClient, events, isOpenRef])

  const handleToggle = () => {
    const next = !isOpen
    setIsOpenState(next)
    isOpenRef.current = next
    setIsOpen(next)
    events.emit(next ? 'open' : 'close')
  }

  const handleClose = () => {
    setIsOpenState(false)
    isOpenRef.current = false
    setIsOpen(false)
    events.emit('close')
  }

  const handlePreviewOpen = useCallback(
    (preview: PendingPreview) => {
      setInitialConvId(preview.conversationId)
      setPreviews((prev) => prev.filter((p) => p.id !== preview.id))
      setIsOpenState(true)
      isOpenRef.current = true
      setIsOpen(true)
      events.emit('open')
    },
    [events, isOpenRef, setIsOpen]
  )

  const handlePreviewDismiss = useCallback((id: string) => {
    setPreviews((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return (
    <>
      {!isHidden && (
        <ChatBubble
          isOpen={isOpen}
          position={position}
          unreadCount={unreadCount}
          onClick={handleToggle}
        />
      )}
      {!isHidden && !isOpen && (
        <FloatingPreview
          previews={previews}
          onOpen={handlePreviewOpen}
          onDismiss={handlePreviewDismiss}
          position={position}
        />
      )}
      {isOpen && (
        <ChatWindow
          channelInfo={channelInfo}
          apiClient={apiClient}
          realtimeClient={realtimeClient}
          storage={storage}
          events={events}
          visitor={visitor}
          isAuthenticated={isAuthenticated}
          position={position}
          onClose={handleClose}
          t={t}
          initialConversationId={initialConvId}
        />
      )}
    </>
  )
}
