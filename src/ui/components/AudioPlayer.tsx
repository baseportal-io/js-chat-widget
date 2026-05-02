/** @jsxImportSource preact */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { warn } from '../../utils/logger'
import { IconPlay } from '../icons'

interface AudioPlayerProps {
  src: string
  /** Stable identifier used to seed the fake waveform — same id
   *  always produces the same bar heights so the visual is stable
   *  across re-renders and tabs. */
  seed: string
}

const BAR_COUNT = 28

/**
 * Lightweight audio bubble for messages. Renders:
 *   - circular play / pause toggle
 *   - 28-bar pseudo-waveform (deterministic per message id)
 *   - mm:ss tracker that flips between current time and total
 *
 * The waveform is "fake" — we don't decode the audio with the Web
 * Audio API because that's expensive (requires fetching + decoding
 * the full file just to render). The visualization conveys progress,
 * not amplitude, which is what visitors actually need from a chat
 * audio bubble.
 */
export function AudioPlayer({ src, seed }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const bars = useMemo(() => generateWave(seed, BAR_COUNT), [seed])

  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // MediaRecorder-produced webm/mp4 blobs frequently lack a duration
    // index in the container header — the browser reports `Infinity`
    // until you seek through the file once. We trigger that probe
    // automatically on first metadata so the bubble shows a real
    // mm:ss before the visitor clicks play. The probe latches via
    // `durationProbed` so we don't loop on the durationchange event
    // we cause ourselves.
    let durationProbed = false

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        return
      }
      if (!durationProbed) {
        durationProbed = true
        try {
          audio.currentTime = 1e10
        } catch {
          // Some browsers throw on this probe; the player still
          // works for playback, only the mm:ss display stays empty.
        }
      }
    }
    const onSeeked = () => {
      // After the duration probe, the browser knows the real length
      // and exposes it. Snap currentTime back to 0 so the player
      // looks untouched and store the resolved duration.
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
      if (durationProbed && audio.currentTime !== 0) {
        try {
          audio.currentTime = 0
        } catch {
          // ignore — currentTime won't matter post-probe
        }
      }
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onError = () => {
      const code = audio.error?.code
      const message = audio.error?.message
      warn('audio failed to load', { src, code, message })
      setLoadError(`Audio failed (${code ?? '?'})`)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch((err) => {
        warn('audio play rejected', err)
        setLoadError(`Play blocked: ${err?.name || 'unknown'}`)
      })
    } else {
      audio.pause()
    }
  }

  const progress =
    duration > 0 ? Math.min(1, currentTime / duration) : 0
  const playedBars = Math.round(progress * BAR_COUNT)
  const displaySeconds = isPlaying || currentTime > 0 ? currentTime : duration

  return (
    <div class="bp-audio">
      <button
        class="bp-audio__play"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <IconPlay />}
      </button>
      <div class="bp-audio__wave" aria-hidden="true">
        {bars.map((h, i) => (
          <i
            key={i}
            class={i < playedBars ? 'is-played' : ''}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      <span class="bp-audio__time">{formatDuration(displaySeconds)}</span>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

/**
 * Deterministic pseudo-random bar heights from a seed string. Same
 * input → same output, so the waveform never reshuffles between
 * renders or across reconnects.
 *
 * Returns floats in [0.25, 1] so no bar is invisible. Heights have
 * a gentle bell shape (taller in the middle, shorter at the edges)
 * so the "audio clip" reads visually even before play.
 */
function generateWave(seed: string, count: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) | 0
    const rand = ((h >>> 16) % 1000) / 1000
    const positionFactor =
      1 - Math.abs((i - count / 2) / (count / 2)) * 0.4
    const height = 0.25 + rand * 0.75 * positionFactor
    result.push(height)
  }
  return result
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
