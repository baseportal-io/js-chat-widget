/** @jsxImportSource preact */

import { useEffect, useState } from 'preact/hooks'

import type { ApiClient } from '../api/client'
import type { ChannelInfo, Message, VisitorData } from '../api/types'
import type { RealtimeClient } from '../realtime/ably-client'
import type { EventEmitter } from '../utils/events'
import { playNotificationSound } from '../utils/notification-sound'
import type { Storage } from '../utils/storage'
import { ChatBubble } from './components/ChatBubble'
import { ChatWindow } from './components/ChatWindow'
import type { Translations } from './i18n'

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
  const [unreadCount] = useState(0)

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

  // Notification sound on inbound admin/AI messages. Visitor echoes
  // (`role === 'client'`) are suppressed — playing back to the
  // sender after they hit send is just noise. The hook itself layers
  // on visibility/focus + dedup gating so this listener stays small.
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
        />
      )}
    </>
  )
}
