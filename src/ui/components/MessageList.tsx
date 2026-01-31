/** @jsxImportSource preact */

import { useEffect, useRef } from 'preact/hooks'

import type { Message } from '../../api/types'

interface MessageListProps {
  messages: Message[]
  loading: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

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
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
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
        <div class="bp-msg__content">{message.content}</div>
        <div class="bp-msg__time">{time}</div>
      </div>
    </div>
  )
}
