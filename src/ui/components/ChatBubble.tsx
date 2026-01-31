/** @jsxImportSource preact */

import { IconChat, IconX } from '../icons'

interface ChatBubbleProps {
  isOpen: boolean
  position: 'bottom-right' | 'bottom-left'
  unreadCount: number
  onClick: () => void
}

export function ChatBubble({
  isOpen,
  position,
  unreadCount,
  onClick,
}: ChatBubbleProps) {
  const posClass =
    position === 'bottom-left' ? 'bp-bubble--left' : 'bp-bubble--right'

  return (
    <button
      class={`bp-bubble ${posClass}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? <IconX /> : <IconChat />}
      {!isOpen && unreadCount > 0 && (
        <span class="bp-bubble__badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
