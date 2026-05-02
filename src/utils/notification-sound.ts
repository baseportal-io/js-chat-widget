import { warn } from './logger'

/**
 * Plays a short alert when an inbound message arrives while the
 * widget isn't actively in front of the visitor.
 *
 * Why embedded base64: the widget ships as a single IIFE the embedder
 * drops on their site, so we can't rely on a sibling `/assets/...` URL
 * being reachable. Inlining the audio (~5KB MP3) keeps the SDK
 * self-contained at the cost of a small bundle bump.
 *
 * The asset is the same `conversation-alert.wav` the admin panel uses
 * (converted to a 64kbps mono MP3) so visitors and admins hear the
 * same sonic identity for "new chat message".
 *
 * Gating intentionally lives here, not at the call site, so multiple
 * future call sites (typing nudges, reopened-conversation pings) all
 * inherit the same dedup + visibility rules.
 */

const NOTIFICATION_SOUND_DATA_URI = 'data:audio/mpeg;base64,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TEFNRTMuMTAwqqqqqqqqqqqqqizL/qrGnZYanMgJBoAMYAIANmANgIhgIQEWYDOCCGBuLoB8XiPwZE7/84LE8i2I/hwA177AB45hS4O0YI4CkmAVgnRgdoOeYbINIGrgagpi1gXcYPcEsGSXgbhgNYFaYOaArmRua7ZsTYPSYXgA6GCSgKJgRwCwYBkAnGAJgH4EAKgDX4KRVLetVuijV7VL/66ut9fdtTmY207QIXXh9u60bWqlIL5lchrrULHYwwizxSiohQknk9k9MXs6V1VAzu8//3rv8/f/NvoudyFhzIKOGM/PjAZwGkwKwCwMEzBTzCeAywydczzMoEgnTBFQxwwHYEtJAK4wIf/zgsTsLCmeFAAP6JTAizBVgKAw/sCPOOHqijGbwfMwUcKtMaEBIDA5AIgwgUFOMkKj3TbPwjYwvwB5EgkYwH4AwMAYARBwA9BIBUDAEceAKdb/+c/1yUk1V1oiJ8NIXM7akV1ZSKrsqTNoiPuykb0lVt97fcm0zLV5ktY8xrlF5RN+vD7c1a5TerfALoDr0avjRBd8sXXbXm5/7MeppSY7/+8/L/3+/rSuQOusAoeAABDAXAtMAYCowOwTTDEFSMCML02rLZzbi07ow68GAMHc//OCxP8zIrYQqs/E0QDkwLsCECAdkwEcI2MP8FzTbXmCcxHYFzMFoBqDDKQFMwXAGXMFRDXDHBCnE0HMSEMIMBeTBHwAwwAYARBwAMFgD0wCkASMAOAIygAFpOfnlzf/j/6/9/lv//973/P7r9/v+73hr/////1j2og8u2FtRLCwBUKPp4Fxjqz51DXJUDIkUyoDFBho0ZyToY1qU8SxYtebY9WYtPnnqgMCAhjAGBfb/MoAL5GPPAQrrzNNjgEjNGTNH/0YGuDCmBUggxlLsUn/84LE9jNJnhADXvgAGAQgU5g9gMyYQeJfUzsvgZUYI0mM8Iqx399hkYKqG/GJbhhRhzQ9rNQ9HTUby1wwcdpsNaBFTzA8ALww3IWtMMmCTjDOwcIeAIX1lkPPsYDUBGmAtgDpgMAB4YBgASBwBQYCaAzGAqgJCxRCAAGAEgBkrpMu+BgBeHHcLvoJy/ZdwvqYAIABmABAArSmXRqg////9dDOF1tUXCxdabTl8NaWGaSoKzmVX6Wa//////WK/MbWAa5DcfaK2KYVWjEudpyoBf/zgsTsVKvB3AOa+AD5w/GrWlUNVaX////////4o/7On3aJD7G3eWQ312TvO+tuFUu6XGajVqlwy/cM1rW///////////SGfSPwyz1xpK/LprcfehjbXnDct98XYi7OquFrK6+taNRqVS67VjLs5VaWal2VTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OCxDsAAANIAcAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU='

interface PlayOptions {
  /**
   * Skip when the widget is currently visible to the visitor (open
   * AND tab focused). The case we care about is "browser tab in the
   * background, admin replies, visitor switches back and sees a
   * waiting message" — playing while they're already reading would
   * just be noise.
   */
  isWidgetActive: boolean
}

const MIN_INTERVAL_MS = 3000

let audio: HTMLAudioElement | null = null
let lastPlayedAt = 0

export function playNotificationSound(options: PlayOptions): void {
  // Active visitor doesn't need a sound — they can already see the
  // message land. The check is OR-of-everything so any sign of
  // attention (open widget, focused tab, visible tab) suppresses it.
  if (options.isWidgetActive) return
  if (typeof document !== 'undefined') {
    if (document.hasFocus() && document.visibilityState === 'visible') {
      // Tab is in front and focused — visitor will see the unread
      // counter on the bubble; the bell would be redundant.
      return
    }
  }

  const now = Date.now()
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return
  lastPlayedAt = now

  try {
    if (!audio) {
      audio = new Audio(NOTIFICATION_SOUND_DATA_URI)
      audio.volume = 0.5
      audio.preload = 'auto'
    }
    // Reset so a quick second message restarts cleanly instead of
    // queuing or being ignored mid-playback.
    audio.pause()
    audio.currentTime = 0
    const p = audio.play()
    if (p && typeof p.catch === 'function') {
      p.catch((e) => {
        // Browser autoplay policies block sound until the visitor
        // interacts with the page. That's expected on first message
        // and not worth surfacing — log behind the debug flag only.
        warn('notification sound play rejected:', e)
      })
    }
  } catch (e) {
    warn('notification sound failed:', e)
  }
}
