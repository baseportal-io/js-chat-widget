/** @jsxImportSource preact */

import { useCallback, useRef } from 'preact/hooks'

import { IconFile, IconPaperclip, IconSend, IconX } from '../icons'
import type { Translations } from '../i18n'

export interface AttachedFile {
  file: File
  preview?: string
}

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  attachedFile: AttachedFile | null
  uploading: boolean
  disabled: boolean
  placeholder?: string
  t: Translations
}

export function MessageInput({
  value,
  onChange,
  onSend,
  onFileSelect,
  onFileRemove,
  attachedFile,
  uploading,
  disabled,
  placeholder,
  t,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      target.style.height = 'auto'
      target.style.height = `${Math.min(target.scrollHeight, 100)}px`
    },
    [onChange]
  )

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: Event) => {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      if (file) {
        onFileSelect(file)
      }
      input.value = ''
    },
    [onFileSelect]
  )

  const isImage = attachedFile?.file.type.startsWith('image/')
  const canSend = (value.trim() || attachedFile) && !disabled && !uploading

  return (
    <div class="bp-composer">
      {attachedFile && (
        <div class="bp-composer__preview">
          {isImage && attachedFile.preview ? (
            <img
              src={attachedFile.preview}
              alt={attachedFile.file.name}
              class="bp-composer__preview-thumb"
            />
          ) : (
            <div class="bp-composer__preview-icon">
              <IconFile />
            </div>
          )}
          <div class="bp-composer__preview-info">
            <div class="bp-composer__preview-name">
              {attachedFile.file.name}
            </div>
            <div class="bp-composer__preview-status">
              {uploading ? t.chat.uploading : formatSize(attachedFile.file.size)}
            </div>
          </div>
          {!uploading && (
            <button
              class="bp-composer__preview-remove"
              onClick={onFileRemove}
              aria-label="Remove file"
            >
              <IconX />
            </button>
          )}
        </div>
      )}

      <div class="bp-composer__row">
        <button
          class="bp-composer__attach"
          onClick={handleAttachClick}
          disabled={disabled || uploading || !!attachedFile}
          aria-label={t.chat.attachFile}
        >
          <IconPaperclip />
        </button>

        <textarea
          ref={textareaRef}
          class="bp-composer__field"
          value={value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t.chat.placeholder}
          disabled={disabled}
          rows={1}
        />

        <button
          class="bp-composer__send"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          <IconSend />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,video/mp4,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
