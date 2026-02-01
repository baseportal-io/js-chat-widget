/** @jsxImportSource preact */

import { useEffect, useRef, useState } from 'preact/hooks'

import type { Message } from '../../api/types'
import type { Translations } from '../i18n'
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

  return (
    <div class="bp-messages">
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
  const cls = isClient ? 'bp-msg bp-msg--client' : 'bp-msg bp-msg--agent'

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div class={cls}>
      {!isClient && (
        <div class="bp-msg__avatar">
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
      <div class="bp-msg__body">
        {message.media && (
          <MessageMedia
            media={message.media}
            onImageClick={onImageClick}
            t={t}
          />
        )}
        {message.content && (
          <div class="bp-msg__content">{message.content}</div>
        )}
        <div class="bp-msg__time">{time}</div>
      </div>
    </div>
  )
}
