/** @jsxImportSource preact */

import { useEffect, useRef, useState } from 'preact/hooks'

import { warn } from '../../utils/logger'
import type { Translations } from '../i18n'
import { IconMic, IconSend, IconTrash } from '../icons'

type Mode = 'idle' | 'recording' | 'sending'

interface AudioRecorderProps {
  /** Called when recording finishes and the user confirms send.
   *  Component owns the MediaRecorder lifecycle and hands the
   *  parent the final Blob. Parent runs upload + message creation. */
  onSend: (audio: Blob, durationSeconds: number) => Promise<void>
  /** Notifies the parent of mode changes so the surrounding composer
   *  (textarea, attach, send) can collapse during recording. */
  onModeChange?: (mode: Mode) => void
  /** Disables the mic button (e.g. while another upload is in
   *  progress or the conversation is closed). */
  disabled?: boolean
  /** Hides the idle button via `display: none`. Used by the parent
   *  composer to keep the AudioRecorder mounted (preserving its
   *  internal MediaRecorder + mode state) while the textarea has
   *  text and the trailing button is the text-send instead. We
   *  intentionally don't unmount the component for that case —
   *  remounting would re-run the idle mode-change effect and bounce
   *  the parent's state. */
  hidden?: boolean
  t: Translations
}

const WAVE_BAR_COUNT = 18

/**
 * Mic-to-message recorder for the widget composer.
 *
 * State machine:
 *   idle      — only the mic icon. The component takes the space of
 *               a single composer button.
 *   recording — full-row replacement: cancel · pulsing dot + timer
 *               · animated wave · send. The parent (`MessageInput`)
 *               watches `onModeChange` and hides its textarea / attach
 *               button so there's no UI overlap.
 *   sending   — same row, controls disabled while the parent uploads
 *               and posts the message.
 *
 * Codec: tries `audio/webm;codecs=opus` first (best browser support
 * + small files), falls back to plain `audio/webm` then `audio/mp4`.
 * The widget uploads the raw container — the API stores it in R2 as
 * a regular media row.
 *
 * Permissions: `getUserMedia` is requested only on the click. If
 * denied, an inline message surfaces and we revert to idle. We don't
 * keep the stream alive between sessions to avoid the browser tab's
 * mic indicator getting stuck.
 */
export function AudioRecorder({
  onSend,
  onModeChange,
  disabled,
  hidden,
  t,
}: AudioRecorderProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  // `cancelled` mirrors mode but is read inside the onstop callback
  // synchronously — by the time onstop fires React state may not be
  // flushed yet, so the ref is the source of truth for cancel vs send.
  const cancelledRef = useRef(false)

  // Notify the parent on every mode change so it can collapse the
  // composer to give us the full row.
  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  // Tick the elapsed timer while recording.
  useEffect(() => {
    if (mode !== 'recording') return
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [mode])

  // Safety net: release mic + recorder if the visitor closes the
  // widget or the conversation unmounts mid-recording.
  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = () => {
    try {
      mediaRecorderRef.current?.stop()
    } catch {
      // already stopped or never started — fine
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }

  const pickMimeType = (): string => {
    // mp4 first: it has the broadest playback support across
    // browsers and works through R2 / signed URLs without quirks.
    // webm/opus is the Chrome / Firefox default for MediaRecorder
    // but Safari can't decode it, and even Chrome occasionally
    // produces webm files with `duration: Infinity` until they're
    // re-muxed — bad for chat-style playback. We pick mp4 when the
    // browser supports recording it (Safari does; recent Chrome /
    // Edge do too via the Media Capabilities API).
    const candidates = [
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ]
    for (const type of candidates) {
      if (
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type
      }
    }
    return ''
  }

  /**
   * Self-test: build a blob URL and ask the browser if it can decode
   * the file we just recorded. Catches the most common failure mode
   * (webm header without duration, codec not in playback set) before
   * we waste an upload round-trip and a chat message on a broken
   * file. Returns true when the audio metadata loads cleanly.
   */
  const verifyPlayable = (blob: Blob): Promise<boolean> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const test = new Audio()
      const cleanup = () => {
        test.onloadedmetadata = null
        test.onerror = null
        URL.revokeObjectURL(url)
      }
      test.onloadedmetadata = () => {
        cleanup()
        resolve(true)
      }
      test.onerror = () => {
        // eslint-disable-next-line no-console
        warn('recorded audio is not playable', {
          code: test.error?.code,
          message: test.error?.message,
        })
        cleanup()
        resolve(false)
      }
      test.src = url
    })
  }

  const startRecording = async () => {
    if (disabled || mode !== 'idle') return
    setError(null)
    cancelledRef.current = false
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const finalMime = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalMime })
        const duration = Math.max(
          1,
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        )

        // Free the mic immediately. The upload happens upstream.
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (cancelledRef.current) {
          setMode('idle')
          return
        }

        // Edge case: stop fired before any chunks were captured
        // (very short tap). Treat as cancel rather than emitting
        // an empty file.
        if (blob.size === 0) {
          setMode('idle')
          return
        }

        // Local playability check before we upload. Failure here
        // means the recorder produced bytes the browser itself
        // can't decode — usually a webm header without a duration
        // index. Bailing early surfaces the issue and avoids
        // shipping a broken bubble that nobody can play.
        const playable = await verifyPlayable(blob)
        if (!playable) {
          setError(t.chat.audioCorrupted)
          setMode('idle')
          chunksRef.current = []
          return
        }

        setMode('sending')
        try {
          await onSend(blob, duration)
        } catch (e) {
          warn('audio send failed:', e)
        } finally {
          chunksRef.current = []
          setMode('idle')
        }
      }

      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
      // No timeslice: with a timeslice arg, some browsers emit
      // partial chunks but never a final flush, leaving short
      // recordings with zero usable bytes. `start()` with no arg
      // means "buffer everything internally and emit one chunk on
      // stop" — the most reliable shape for short voice messages.
      recorder.start()
      setMode('recording')
    } catch (e) {
      warn('mic permission denied or unavailable:', e)
      setError(t.chat.audioPermissionDenied)
      cleanup()
      setMode('idle')
    }
  }

  const stopAndSend = () => {
    cancelledRef.current = false
    mediaRecorderRef.current?.stop()
  }

  const cancel = () => {
    cancelledRef.current = true
    mediaRecorderRef.current?.stop()
  }

  if (mode === 'idle') {
    return (
      <>
        <button
          class="bp-wcomp__btn"
          onClick={startRecording}
          disabled={disabled}
          title={t.chat.recordAudio}
          aria-label={t.chat.recordAudio}
          style={hidden ? { display: 'none' } : undefined}
        >
          <IconMic />
        </button>
        {error && !hidden && <div class="bp-wcomp__error">{error}</div>}
      </>
    )
  }

  // Recording / sending: takes the full composer row. The parent
  // hides its textarea + buttons via the onModeChange signal.
  return (
    <div class="bp-wrec">
      <button
        class="bp-wrec__cancel"
        onClick={cancel}
        disabled={mode === 'sending'}
        title={t.chat.cancelAudio}
        aria-label={t.chat.cancelAudio}
      >
        <IconTrash />
      </button>
      <span class="bp-wrec__indicator">
        <span class="bp-wrec__dot" />
        <span class="bp-wrec__time">{formatDuration(elapsedSeconds)}</span>
      </span>
      <span class="bp-wrec__wave" aria-hidden="true">
        {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => (
          <i
            key={i}
            // Stagger the animation across bars so the row reads as a
            // wave moving across rather than every bar pulsing
            // together. Index-based delay keeps it deterministic so
            // bars in the same position always animate the same way.
            style={{ animationDelay: `${(i % 6) * 0.1}s` }}
          />
        ))}
      </span>
      <button
        class="bp-wrec__send"
        onClick={stopAndSend}
        disabled={mode === 'sending'}
        title={t.chat.sendAudio}
        aria-label={t.chat.sendAudio}
      >
        <IconSend />
      </button>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
