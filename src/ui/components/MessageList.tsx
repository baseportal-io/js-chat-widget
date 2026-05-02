/** @jsxImportSource preact */

import { useEffect, useRef, useState } from 'preact/hooks'

import type { Message } from '../../api/types'
import { whatsappToHtml } from '../../utils/markdown'
import type { Translations } from '../i18n'
import { IconChat } from '../icons'
import { ImageLightbox } from './ImageLightbox'
import { MessageMedia } from './MessageMedia'

interface MessageListProps {
  messages: Message[]
  loading: boolean
  t: Translations
}

export function MessageList({ messages, loading, t }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div class="bp-loading">
        <div class="bp-spinner" />
      </div>
    )
  }

  // Empty thread: nudge the visitor to send the first message instead
  // of leaving them staring at a blank canvas. The composer is still
  // available below; this is purely encouragement copy.
  if (messages.length === 0) {
    return (
      <div class="bp-wthread bp-wthread--empty">
        <div class="bp-wempty">
          <div class="bp-wempty__ico">
            <IconChat />
          </div>
          <h4>{t.chat.emptyTitle}</h4>
          <p>{t.chat.emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div class="bp-wthread">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onImageClick={setLightboxSrc}
          t={t}
        />
      ))}
      <div ref={endRef} />
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  )
}

function MessageBubble({
  message,
  onImageClick,
  t,
}: {
  message: Message
  onImageClick: (src: string) => void
  t: Translations
}) {
  const isClient = message.role === 'client'
  const cls = isClient ? 'bp-wmsg bp-wmsg--me' : 'bp-wmsg bp-wmsg--them'

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div class={cls}>
      {!isClient && (
        <div class="bp-wmsg__avatar">
          {message.user?.avatar?.url ? (
            <img
              src={message.user.avatar.url}
              alt={message.user.firstName || 'Agent'}
            />
          ) : (
            (message.user?.firstName?.[0] || 'A').toUpperCase()
          )}
        </div>
      )}
      <div class="bp-wmsg__body">
        <div class="bp-wmsg__bubble">
          {message.media && (
            <MessageMedia
              media={message.media}
              onImageClick={onImageClick}
              t={t}
            />
          )}
          {message.content && (
            <div
              // The agent emits WhatsApp-style markdown (*bold*, _italic_,
              // etc.). whatsappToHtml escapes the input first, so injecting
              // HTML through this path is not possible.
              dangerouslySetInnerHTML={{
                __html: whatsappToHtml(message.content),
              }}
            />
          )}
        </div>
        <div class="bp-wmsg__time">{time}</div>
      </div>
    </div>
  )
}
