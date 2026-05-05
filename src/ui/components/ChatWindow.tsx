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
import type { Translations } from '../i18n'
import { warn } from '../../utils/logger'
import { MessageInput, type AttachedFile } from './MessageInput'
import { MessageList } from './MessageList'
import { PreChatForm } from './PreChatForm'
import { BottomTabs, type Tab } from './shell/BottomTabs'
import { HeaderHero } from './shell/HeaderHero'
import { HeaderNav } from './shell/HeaderNav'
import { HeaderSolid } from './shell/HeaderSolid'
import { ArticleView } from './views/ArticleView'
import { HelpView } from './views/HelpView'
import { HomeView } from './views/HomeView'
import { MessagesView } from './views/MessagesView'

type View = null | 'chat' | 'article' | 'prechat'

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
  isInContainer?: boolean
}

/**
 * V1 widget shell. Owns three orthogonal pieces of state:
 *
 *   - `tab`  — which footer tab is selected (home / msgs / help)
 *   - `view` — when present, an *overlay* view that takes over the
 *              window (chat thread, article reader, prechat form).
 *              When null, the active `tab`'s body is shown.
 *
 * Decisions on view precedence:
 *   1. `view === 'prechat'` → PreChatForm
 *   2. `view === 'chat'`    → ChatView (HeaderNav + thread + composer)
 *   3. `view === 'article'` → ArticleView (HeaderNav + reader)
 *   4. `view === null`      → tab body + BottomTabs
 *
 * The Help tab is hidden entirely when the channel has no KB linked
 * — there's nothing to render. The footer tabs collapse to two.
 */
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
  isInContainer,
}: ChatWindowProps) {
  const [tab, setTab] = useState<Tab>('home')
  const [view, setView] = useState<View>(null)
  const [homeSearch, setHomeSearch] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeArticleSlug, setActiveArticleSlug] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const allowViewHistory = channelInfo.config.allowViewHistory && isAuthenticated
  const showHelpTab = !!channelInfo.knowledgeBase

  const startNewConversationRef = useRef<() => Promise<void>>(async () => {})

  const needsPreChat = useCallback((): boolean => {
    if (visitor?.name && visitor?.email) return false
    return channelInfo.config.requireName || channelInfo.config.requireEmail
  }, [channelInfo, visitor])

  const connectRealtime = useCallback(
    (convId: string) => {
      realtimeClient.subscribe(convId, {
        onMessage: (msg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
            }
            const withoutTemp = prev.filter(
              (m) => !String(m.id).startsWith('temp-') || m.content !== msg.content
            )
            return [...withoutTemp, msg]
          })
          events.emit('message:received', msg)
        },
        onConversationStatusUpdate: (conv) => {
          setConversation((prev) => (prev ? { ...prev, open: conv.open } : prev))
          if (!conv.open) {
            // Anonymous visitors see a single "active conversation" in
            // the Home/Messages tabs derived from this list. The moment
            // the admin closes the thread, drop it so the next return to
            // Home shows the empty state instead of a stale row.
            if (!isAuthenticated) {
              setConversations([])
              storage.clearConversationId()
            }
            events.emit('conversation:closed', conv)
          }
        },
      })
    },
    [realtimeClient, events, isAuthenticated, storage]
  )

  const openConversation = useCallback(
    async (convId: string) => {
      setLoading(true)
      try {
        const [conv, msgs] = await Promise.all([
          apiClient.getConversation(convId),
          apiClient.getMessages(convId, { limit: 50 }),
        ])
        setConversation(conv)
        // For anonymous visitors the Home/Messages tabs render off
        // `conversations[]`, which is otherwise never populated (the
        // /conversations endpoint requires identity). Mirror the
        // currently-loaded thread into the list when it's still open
        // so the visitor can navigate back to it from the tabs.
        // Closed threads stay out per "fechou, sumiu da lista".
        if (!isAuthenticated) {
          setConversations(conv.open ? [conv] : [])
        }
        setMessages(Array.isArray(msgs) ? msgs.reverse() : [])
        setView('chat')
        events.emit('conversation:viewing', convId)
        if (conv.open) {
          storage.setConversationId(convId)
          connectRealtime(convId)
        } else if (!isAuthenticated) {
          // Drop the persisted id so the next reload doesn't put the
          // visitor straight back into a dead thread.
          storage.clearConversationId()
        } else {
          storage.setConversationId(convId)
        }
      } catch (e) {
        console.error('[BaseportalChat] Error opening conversation:', e)
      } finally {
        setLoading(false)
      }
    },
    [apiClient, storage, connectRealtime, events, isAuthenticated]
  )

  const startNewConversation = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiClient.initConversation({
        name: visitor?.name,
        email: visitor?.email,
      })
      setConversation(result)
      // Anonymous visitors: mirror the just-created conversation into
      // the list so it shows up under Messages and as "Continue de onde
      // parou" on Home when the visitor steps out of the chat view.
      if (!isAuthenticated) setConversations([result])
      setMessages(result.messages || [])
      setView('chat')
      events.emit('conversation:viewing', result.id)
      storage.setConversationId(result.id)
      connectRealtime(result.id)
      events.emit('conversation:started', result)
    } catch (e) {
      console.error('[BaseportalChat] Error starting conversation:', e)
    } finally {
      setLoading(false)
    }
  }, [apiClient, visitor, storage, connectRealtime, events, isAuthenticated])

  startNewConversationRef.current = startNewConversation

  const handleStartConversation = useCallback(() => {
    if (needsPreChat()) {
      setView('prechat')
    } else {
      startNewConversation()
    }
  }, [needsPreChat, startNewConversation])

  const refreshConversations = useCallback(async () => {
    if (!allowViewHistory) return
    try {
      const list = await apiClient.getVisitorConversations()
      setConversations(list)
    } catch {
      // ignore — list stays empty
    }
  }, [allowViewHistory, apiClient])

  // Initial load: pull conversation list (if history allowed) and
  // honor `initialConversationId` if it lines up with one of them.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      try {
        if (allowViewHistory) {
          const list = await apiClient.getVisitorConversations()
          if (cancelled) return
          setConversations(list)

          if (initialConversationId) {
            const conv = list.find((c) => c.id === initialConversationId)
            if (conv) {
              await openConversation(conv.id)
              return
            }
          }
        }

        // Restore localStorage conversation if any (works for both
        // anonymous and authenticated visitors).
        const storedId = initialConversationId || storage.getConversationId()
        if (storedId && !allowViewHistory) {
          try {
            await openConversation(storedId)
            return
          } catch {
            storage.clear()
          }
        }
      } catch (e) {
        console.error('[BaseportalChat] Error initializing:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
      realtimeClient.unsubscribe()
      // Window is going away — App's viewing-conv ref must drop back
      // to null so cross-conversation notifications resume firing.
      events.emit('conversation:viewing', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenArticle = useCallback((slug: string) => {
    setActiveArticleSlug(slug)
    setView('article')
  }, [])

  const handleBackFromOverlay = useCallback(() => {
    setView(null)
    if (view === 'chat') {
      realtimeClient.unsubscribe()
      setMessages([])
      setConversation(null)
      events.emit('conversation:viewing', null)
      refreshConversations()
    }
  }, [view, realtimeClient, refreshConversations, events])

  const handlePreChatSubmit = useCallback(
    async (data: { name?: string; email?: string }) => {
      storage.setVisitor({ ...visitor, ...data })
      const result = await apiClient.initConversation(data)
      setConversation(result)
      if (!isAuthenticated) setConversations([result])
      setMessages(result.messages || [])
      setView('chat')
      events.emit('conversation:viewing', result.id)
      storage.setConversationId(result.id)
      connectRealtime(result.id)
      events.emit('conversation:started', result)
    },
    [apiClient, visitor, storage, connectRealtime, events, isAuthenticated]
  )

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!conversation) return
      const MAX_SIZE = 25 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        warn('File too large')
        return
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
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

  /**
   * Audio path: AudioRecorder hands a Blob, we wrap it in a File
   * with a stable name so the upload endpoint stores it as a
   * regular media item and posts a message pointing at it. We do
   * NOT push an optimistic bubble first — audio is small enough
   * that the round-trip is fast and the realtime echo paints the
   * bubble naturally.
   */
  const handleSendAudio = useCallback(
    async (blob: Blob, _durationSeconds: number): Promise<void> => {
      if (!conversation) return
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `audio-${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      })
      try {
        const uploaded = await apiClient.uploadFile(conversation.id, file)
        const msg = await apiClient.sendMessage(conversation.id, {
          mediaId: uploaded.id,
        })
        events.emit('message:sent', msg)
      } catch (e) {
        console.error('[BaseportalChat] Error sending audio:', e)
        throw e
      }
    },
    [apiClient, conversation, events]
  )

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
      const errMsg = e instanceof Error ? e.message : ''
      if (errMsg.includes('Row not found') || errMsg.includes('404')) {
        realtimeClient.unsubscribe()
        setConversation((prev) => (prev ? { ...prev, open: false } : prev))
        if (!isAuthenticated) {
          setConversations([])
          storage.clearConversationId()
        }
      } else {
        setInputValue(content)
      }
    } finally {
      setSending(false)
    }
  }, [inputValue, uploadedFileId, conversation, sending, apiClient, events, realtimeClient, isAuthenticated, storage])

  const handleReopen = useCallback(async () => {
    if (!conversation) return
    try {
      const updated = await apiClient.reopenConversation(conversation.id)
      setConversation((prev) => (prev ? { ...prev, open: updated.open ?? true } : prev))
    } catch (e) {
      console.error('[BaseportalChat] Error reopening conversation:', e)
    }
  }, [conversation, apiClient])

  // Every open conversation, sorted by most recent activity. Used by
  // HomeView to surface all parallel threads (previously only one
  // would show, hiding the rest of the visitor's pending conversations
  // — a regression once each automation started getting its own
  // conversation).
  const openConversations = conversations
    .filter((c) => c.open)
    .slice()
    .sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return tb - ta
    })
  const unreadTotal = conversations.reduce(
    (sum, c) => sum + ((c as any).unreadMessagesCount || 0),
    0
  )

  const posClass = position === 'bottom-left' ? 'bp-window--left' : 'bp-window--right'
  const containerClass = isInContainer ? 'bp-window--in-container' : posClass

  // ── Overlay views (chat / article / prechat) ───────────────────
  if (view === 'prechat') {
    return (
      <div class={`bp-window ${containerClass}`}>
        <HeaderNav onBack={() => setView(null)} onClose={onClose}>
          {t.prechat.title}
        </HeaderNav>
        <PreChatForm
          channelInfo={channelInfo}
          onSubmit={handlePreChatSubmit}
          loading={loading}
          t={t}
        />
      </div>
    )
  }

  if (view === 'chat') {
    const headerTitle = conversation?.lastMessage?.user
      ? `${conversation.lastMessage.user.firstName} ${conversation.lastMessage.user.lastName}`
      : channelInfo.name
    const isOpen = conversation?.open !== false

    return (
      <div class={`bp-window ${containerClass}`}>
        <HeaderNav onBack={handleBackFromOverlay} onClose={onClose}>
          {headerTitle}
        </HeaderNav>
        <MessageList messages={messages} loading={loading} t={t} />
        {isOpen ? (
          <MessageInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            onSendAudio={handleSendAudio}
            attachedFile={attachedFile}
            uploading={uploading}
            disabled={sending || loading}
            placeholder={t.chat.placeholder}
            t={t}
          />
        ) : (
          <div class="bp-closed-banner">
            <span class="bp-closed-banner__text">{t.chat.closed}</span>
            {channelInfo.config.allowReopenConversation ? (
              <button class="bp-closed-banner__reopen" onClick={handleReopen}>
                {t.chat.reopen}
              </button>
            ) : (
              <button class="bp-closed-banner__reopen" onClick={handleStartConversation}>
                {t.chat.newConversation}
              </button>
            )}
          </div>
        )}
        {channelInfo.config.privacyPolicyUrl && (
          <div class="bp-privacy-footer">
            <a href={channelInfo.config.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
              {t.prechat.privacyLink}
            </a>
          </div>
        )}
      </div>
    )
  }

  if (view === 'article' && activeArticleSlug) {
    return (
      <div class={`bp-window ${containerClass}`}>
        <HeaderNav onBack={() => setView(null)} onClose={onClose}>
          {t.article.backToHelp}
        </HeaderNav>
        <ArticleView
          apiClient={apiClient}
          slug={activeArticleSlug}
          knowledgeBase={channelInfo.knowledgeBase || null}
          t={t}
        />
        <BottomTabs
          active="help"
          onChange={(next) => {
            setView(null)
            setTab(next)
          }}
          unreadCount={unreadTotal}
          showHelp={showHelpTab}
          t={t}
        />
      </div>
    )
  }

  // ── Tab bodies ─────────────────────────────────────────────────
  return (
    <div class={`bp-window ${containerClass}`}>
      {tab === 'home' && (
        <>
          <HeaderHero
            channelName={channelInfo.name}
            visitorName={visitor?.name}
            administrators={channelInfo.administrators || []}
            responseTimeSeconds={channelInfo.responseTime?.seconds ?? null}
            onClose={onClose}
            search={
              showHelpTab
                ? {
                    value: homeSearch,
                    onInput: setHomeSearch,
                    placeholder: t.home.searchHelpPlaceholder,
                  }
                : undefined
            }
            t={t}
          />
          <HomeView
            channelInfo={channelInfo}
            visitorName={visitor?.name}
            openConversations={openConversations}
            onStartConversation={handleStartConversation}
            onOpenConversation={openConversation}
            onOpenArticle={handleOpenArticle}
            onGoToHelp={() => setTab('help')}
            apiClient={apiClient}
            search={homeSearch}
            onSearchChange={setHomeSearch}
            t={t}
          />
        </>
      )}

      {tab === 'msgs' && (
        <>
          <HeaderSolid title={t.messages.title} onClose={onClose} />
          <MessagesView
            conversations={conversations}
            onOpen={openConversation}
            onNew={handleStartConversation}
            t={t}
          />
        </>
      )}

      {tab === 'help' && (
        <>
          <HeaderSolid title={t.help.title} subtitle={t.help.subtitle} onClose={onClose} />
          <HelpView apiClient={apiClient} onOpenArticle={handleOpenArticle} t={t} />
        </>
      )}

      <BottomTabs
        active={tab}
        onChange={setTab}
        unreadCount={unreadTotal}
        showHelp={showHelpTab}
        t={t}
      />
    </div>
  )
}
