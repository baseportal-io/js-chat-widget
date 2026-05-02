/** @jsxImportSource preact */

import { useCallback, useRef, useState } from 'preact/hooks'

import type { Translations } from '../i18n'
import { IconFile, IconPaperclip, IconSend, IconX } from '../icons'
import { AudioRecorder } from './AudioRecorder'

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
  /** Hands a recorded audio Blob up to ChatWindow which then uploads
   *  it via /upload and posts a message with the resolved mediaId.
   *  Optional: when undefined, the mic button doesn't render. */
  onSendAudio?: (audio: Blob, durationSeconds: number) => Promise<void>
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
  onSendAudio,
  attachedFile,
  uploading,
  disabled,
  placeholder,
  t,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // recorderMode is lifted into MessageInput so the textarea / attach
  // button / send button can collapse during recording. The
  // AudioRecorder itself is always rendered in the SAME tree position
  // (see render below) — re-mounting it would reset its internal
  // MediaRecorder ref and bounce the mode straight back to 'idle',
  // causing a visible flash where the composer flips into recording
  // and immediately reverts.
  const [recorderMode, setRecorderMode] = useState<'idle' | 'recording' | 'sending'>(
    'idle'
  )
  const isRecording = recorderMode !== 'idle'

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
  const hasContent = !!value.trim() || !!attachedFile

  // The mic is shown only when:
  //   - the parent enabled audio (onSendAudio defined)
  //   - the input is empty (no text, no file) — in those cases the
  //     trailing button is the text-send instead
  //   - we're not currently recording (idle state of the recorder
  //     itself; the recorder takes the full row when active)
  const showMic = !!onSendAudio && !hasContent
  // Trailing text-send only when there's something to send.
  const showTextSend = hasContent && !isRecording

  return (
    <div class="bp-wcomp">
      {attachedFile && !isRecording && (
        <div class="bp-wcomp__preview">
          {isImage && attachedFile.preview ? (
            <img
              src={attachedFile.preview}
              alt={attachedFile.file.name}
              class="bp-wcomp__preview-thumb"
            />
          ) : (
            <IconFile />
          )}
          <div class="bp-wcomp__preview-name">
            {attachedFile.file.name}
            {uploading && <span style={{ opacity: 0.7 }}> · {t.chat.uploading}</span>}
          </div>
          {!uploading && (
            <button
              class="bp-wcomp__preview-remove"
              onClick={onFileRemove}
              aria-label="Remove file"
            >
              <IconX />
            </button>
          )}
        </div>
      )}

      {/*
        Composer row: when not recording, paperclip + textarea + the
        AudioRecorder (which renders just the mic in idle) + optional
        text-send button.
        When recording, those elements collapse via `display: none` so
        the AudioRecorder's recording UI takes the full width — but
        the AudioRecorder element itself stays mounted at the same
        position. Toggling visibility instead of conditional rendering
        prevents the recorder from being unmounted and remounted (which
        would reset its MediaRecorder + state, kicking the mode back
        to idle and causing the "flash → revert" the user reported).
      */}
      <div
        class={`bp-wcomp__row ${isRecording ? 'bp-wcomp__row--bare' : ''}`}
      >
        {!isRecording && (
          <button
            class="bp-wcomp__btn"
            onClick={handleAttachClick}
            disabled={disabled || uploading || !!attachedFile}
            aria-label={t.chat.attachFile}
          >
            <IconPaperclip />
          </button>
        )}

        {!isRecording && (
          <textarea
            ref={textareaRef}
            class="bp-wcomp__input"
            value={value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t.chat.placeholder}
            disabled={disabled}
            rows={1}
          />
        )}

        {/*
          Always rendered when `onSendAudio` is set — the visibility of
          the idle mic button is controlled by `hidden`. While recording,
          the AudioRecorder takes over visually; `hidden` is dropped so
          it can paint. When the input has text, the recorder is
          present but `hidden`, ready to take focus the moment the user
          clears the textarea.
        */}
        {onSendAudio && (
          <AudioRecorder
            onSend={onSendAudio}
            onModeChange={setRecorderMode}
            disabled={disabled || uploading}
            hidden={!showMic && !isRecording}
            t={t}
          />
        )}

        {showTextSend && (
          <button
            class="bp-wcomp__btn bp-wcomp__btn--send"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <IconSend />
          </button>
        )}
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
