/** @jsxImportSource preact */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import type { ApiClient } from '../../api/client'
import type {
  ChannelInfo,
  Conversation,
  Message,
  VisitorData,
} from '../../api/types'
import type { RealtimeClient } from '../../realtime/ably-client'
import type { EventEmitter } from '../../utils/events'
import type { Storage } from '../../utils/storage'
import { IconArrowLeft, IconX } from '../icons'
import type { Translations } from '../i18n'
import { ConversationList } from './ConversationList'
import { MessageInput, type AttachedFile } from './MessageInput'
import { MessageList } from './MessageList'
import { PreChatForm } from './PreChatForm'

type View = 'prechat' | 'conversations' | 'chat'

interface ChatWindowProps {
  channelInfo: ChannelInfo
  apiClient: ApiClient
  realtimeClient: RealtimeClient
  storage: Storage
  events: EventEmitter
  visitor: VisitorData | null
  isAuthenticated: boolean
  position: 'bottom-right' | 'bottom-left'
  onClose: () => void
  t: Translations
  initialConversationId?: string | null
}

export function ChatWindow({
  channelInfo,
  apiClient,
  realtimeClient,
  storage,
  events,
  visitor,
  isAuthenticated,
  position,
  onClose,
  t,
  initialConversationId,
}: ChatWindowProps) {
  const [view, setView] = useState<View>('chat')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const isOpen = conversation?.open !== false

  const allowViewHistory = channelInfo.config.allowViewHistory && isAuthenticated

  // Ref to break circular dependency between connectRealtime and startNewConversation
  const startNewConversationRef = useRef<() => Promise<void>>(async () => {})

  // Determine initial view
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        if (allowViewHistory) {
          // History mode: load conversation list
          const convs = await apiClient.getVisitorConversations()
          setConversations(convs)

          if (initialConversationId) {
            const conv = convs.find((c) => c.id === initialConversationId)
            if (conv) {
              await openConversation(conv)
              return
            }
          }

          if (convs.length > 0) {
            setView('conversations')
          } else {
            if (needsPreChat()) {
              setView('prechat')
            } else {
              await startNewConversation()
            }
          }
        } else {
          // No history: check localStorage for existing conversation
          const storedId =
            initialConversationId || storage.getConversationId()

          if (storedId) {
            try {
              const conv = await apiClient.getConversation(storedId)
              if (!conv.open) {
                // Conversation is closed, clear and start fresh
                storage.clear()
                if (needsPreChat()) {
                  setView('prechat')
                } else {
                  await startNewConversation()
                }
              } else {
                const msgs = await apiClient.getMessages(storedId, { limit: 50 })
                setMessages(Array.isArray(msgs) ? msgs.reverse() : [])
                setConversation(conv)
                setView('chat')
                connectRealtime(storedId)
              }
            } catch {
              storage.clear()
              if (needsPreChat()) {
                setView('prechat')
              } else {
                await startNewConversation()
              }
            }
          } else {
            if (needsPreChat()) {
              setView('prechat')
            } else {
              await startNewConversation()
            }
          }
        }
      } catch (e) {
        console.error('[BaseportalChat] Error initializing:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      realtimeClient.unsubscribe()
    }
  }, [])

  const needsPreChat = useCallback((): boolean => {
    if (visitor?.name && visitor?.email) return false
    return (
      channelInfo.config.requireName || channelInfo.config.requireEmail
    )
  }, [channelInfo, visitor])

  const connectRealtime = useCallback(
    (convId: string) => {
      realtimeClient.subscribe(convId, {
        onMessage: (msg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              return prev.map((m) =>
                m.id === msg.id ? { ...m, ...msg } : m
              )
            }
            const withoutTemp = prev.filter(
              (m) =>
                !String(m.id).startsWith('temp-') ||
                m.content !== msg.content
            )
            return [...withoutTemp, msg]
          })
          events.emit('message:received', msg)
        },
        onConversationStatusUpdate: (conv) => {
          setConversation((prev) =>
            prev ? { ...prev, open: conv.open } : prev
          )
          if (!conv.open) {
            events.emit('conversation:closed', conv)
            // Reset widget so user can start a new conversation
            setTimeout(() => {
              realtimeClient.unsubscribe()
              storage.clear()
              setConversation(null)
              setMessages([])
              if (allowViewHistory) {
                apiClient
                  .getVisitorConversations()
                  .then(setConversations)
                  .catch(() => {})
                setView('conversations')
              } else if (needsPreChat()) {
                setView('prechat')
              } else {
                startNewConversationRef.current()
              }
            }, 2000)
          }
        },
      })
    },
    [realtimeClient, events, storage, allowViewHistory, apiClient, needsPreChat]
  )

  const openConversation = useCallback(
    async (conv: Conversation) => {
      setLoading(true)
      try {
        const msgs = await apiClient.getMessages(conv.id, { limit: 50 })
        setMessages(Array.isArray(msgs) ? msgs.reverse() : [])
        setConversation(conv)
        setView('chat')
        storage.setConversationId(conv.id)
        connectRealtime(conv.id)
      } catch (e) {
        console.error('[BaseportalChat] Error opening conversation:', e)
      } finally {
        setLoading(false)
      }
    },
    [apiClient, storage, connectRealtime]
  )

  const startNewConversation = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiClient.initConversation({
        name: visitor?.name,
        email: visitor?.email,
      })
      setConversation(result)
      setMessages(result.messages || [])
      setView('chat')
      storage.setConversationId(result.id)
      connectRealtime(result.id)
      events.emit('conversation:started', result)
    } catch (e) {
      console.error('[BaseportalChat] Error starting conversation:', e)
    } finally {
      setLoading(false)
    }
  }, [apiClient, visitor, storage, connectRealtime, events])

  startNewConversationRef.current = startNewConversation

  const handlePreChatSubmit = useCallback(
    async (data: { name?: string; email?: string }) => {
      storage.setVisitor({ ...visitor, ...data })
      const result = await apiClient.initConversation(data)
      setConversation(result)
      setMessages(result.messages || [])
      setView('chat')
      storage.setConversationId(result.id)
      connectRealtime(result.id)
      events.emit('conversation:started', result)
    },
    [apiClient, visitor, storage, connectRealtime, events]
  )

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!conversation) return

      const MAX_SIZE = 25 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        console.warn('[BaseportalChat] File too large')
        return
      }

      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      setAttachedFile({ file, preview })
      setUploading(true)

      try {
        const uploaded = await apiClient.uploadFile(conversation.id, file)
        setUploadedFileId(uploaded.id)
      } catch (e) {
        console.error('[BaseportalChat] Error uploading file:', e)
        setAttachedFile(null)
        if (preview) URL.revokeObjectURL(preview)
      } finally {
        setUploading(false)
      }
    },
    [apiClient, conversation]
  )

  const handleFileRemove = useCallback(() => {
    if (attachedFile?.preview) URL.revokeObjectURL(attachedFile.preview)
    setAttachedFile(null)
    setUploadedFileId(null)
  }, [attachedFile])

  const handleSend = useCallback(async () => {
    const content = inputValue.trim()
    if ((!content && !uploadedFileId) || !conversation || sending) return

    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      content,
      role: 'client',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const mediaId = uploadedFileId || undefined

    setInputValue('')
    setAttachedFile(null)
    setUploadedFileId(null)
    setSending(true)
    setMessages((prev) => [...prev, optimistic])

    try {
      const msg = await apiClient.sendMessage(conversation.id, {
        content: content || undefined,
        mediaId,
      })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)))
      events.emit('message:sent', msg)
    } catch (e) {
      console.error('[BaseportalChat] Error sending message:', e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))

      // If conversation no longer exists, reset to allow new conversation
      const errMsg = e instanceof Error ? e.message : ''
      if (errMsg.includes('Row not found') || errMsg.includes('404')) {
        realtimeClient.unsubscribe()
        storage.clear()
        setConversation(null)
        setMessages([])
        if (allowViewHistory) {
          apiClient
            .getVisitorConversations()
            .then(setConversations)
            .catch(() => {})
          setView('conversations')
        } else if (needsPreChat()) {
          setView('prechat')
        } else {
          await startNewConversationRef.current()
        }
      } else {
        setInputValue(content)
      }
    } finally {
      setSending(false)
    }
  }, [inputValue, uploadedFileId, conversation, sending, apiClient, events, realtimeClient, storage, allowViewHistory, needsPreChat])

  const handleReopen = useCallback(async () => {
    if (!conversation) return
    try {
      const updated = await apiClient.reopenConversation(conversation.id)
      setConversation((prev) => prev ? { ...prev, open: updated.open ?? true } : prev)
    } catch (e) {
      console.error('[BaseportalChat] Error reopening conversation:', e)
    }
  }, [conversation, apiClient])

  const handleBack = useCallback(() => {
    if (allowViewHistory && view === 'chat') {
      realtimeClient.unsubscribe()
      setView('conversations')
      setConversation(null)
      setMessages([])
      apiClient.getVisitorConversations().then(setConversations).catch(() => {})
    } else {
      onClose()
    }
  }, [allowViewHistory, view, realtimeClient, apiClient, onClose])

  const posClass =
    position === 'bottom-left' ? 'bp-window--left' : 'bp-window--right'

  const headerTitle =
    view === 'conversations'
      ? t.conversations.title
      : channelInfo.name

  const showBack =
    (allowViewHistory && view === 'chat') || view === 'prechat'

  return (
    <div class={`bp-window ${posClass}`}>
      {/* Header */}
      <div class="bp-header">
        <div class="bp-header__title">
          {showBack && (
            <button class="bp-header__back" onClick={handleBack}>
              <IconArrowLeft />
            </button>
          )}
          {headerTitle}
        </div>
        <button class="bp-header__close" onClick={onClose}>
          <IconX />
        </button>
      </div>

      {/* Content */}
      {loading && view !== 'chat' ? (
        <div class="bp-loading">
          <div class="bp-spinner" />
        </div>
      ) : (
        <>
          {view === 'prechat' && (
            <PreChatForm
              channelInfo={channelInfo}
              onSubmit={handlePreChatSubmit}
              loading={loading}
              t={t}
            />
          )}

          {view === 'conversations' && (
            <ConversationList
              conversations={conversations}
              channelInfo={channelInfo}
              loading={loading}
              onSelect={openConversation}
              onNew={
                needsPreChat()
                  ? () => setView('prechat')
                  : startNewConversation
              }
              t={t}
            />
          )}

          {view === 'chat' && (
            <>
              <MessageList messages={messages} loading={loading} t={t} />
              {isOpen ? (
                <MessageInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  attachedFile={attachedFile}
                  uploading={uploading}
                  disabled={sending || loading}
                  placeholder={t.chat.placeholder}
                  t={t}
                />
              ) : (
                <div class="bp-closed-banner">
                  <span class="bp-closed-banner__text">{t.chat.closed}</span>
                  {channelInfo.config.allowReopenConversation && (
                    <button class="bp-closed-banner__reopen" onClick={handleReopen}>
                      {t.chat.reopen}
                    </button>
                  )}
                </div>
              )}
              {channelInfo.config.privacyPolicyUrl && (
                <div class="bp-privacy-footer">
                  <a
                    href={channelInfo.config.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.prechat.privacyLink}
                  </a>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
