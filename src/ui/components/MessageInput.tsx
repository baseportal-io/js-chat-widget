/** @jsxImportSource preact */

import { useCallback, useRef } from 'preact/hooks'

import { IconSend } from '../icons'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  placeholder?: string
}

export function MessageInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend]
  )

  const handleInput = useCallback(
    (e: Event) => {
      const target = e.target as HTMLTextAreaElement
      onChange(target.value)
      // Auto-resize
      target.style.height = 'auto'
      target.style.height = `${Math.min(target.scrollHeight, 100)}px`
    },
    [onChange]
  )

  return (
    <div class="bp-input">
      <textarea
        ref={textareaRef}
        class="bp-input__field"
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        class="bp-input__send"
        onClick={onSend}
        disabled={!value.trim() || disabled}
        aria-label="Send message"
      >
        <IconSend />
      </button>
    </div>
  )
}
