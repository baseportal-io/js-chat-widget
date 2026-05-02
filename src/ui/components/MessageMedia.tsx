/** @jsxImportSource preact */

import type { Message } from '../../api/types'
import type { Translations } from '../i18n'
import { IconDownload, IconFile } from '../icons'
import { AudioPlayer } from './AudioPlayer'

interface MessageMediaProps {
  media: NonNullable<Message['media']>
  onImageClick: (src: string) => void
  t: Translations
}

export function MessageMedia({ media, onImageClick, t }: MessageMediaProps) {
  const mimeType = (media.mimeType || '').toLowerCase()

  if (mimeType.startsWith('image/') || media.kind === 'image') {
    const thumbSrc = media.streamUrlData?.small || media.url
    const fullSrc = media.streamUrlData?.large || media.url
    return (
      <img
        src={thumbSrc}
        alt={media.name}
        class="bp-media-img"
        onClick={() => onImageClick(fullSrc)}
      />
    )
  }

  if (mimeType.startsWith('video/')) {
    return (
      <video controls class="bp-media-video" preload="metadata">
        <source src={media.url} type={mimeType} />
      </video>
    )
  }

  // Audio bubble: chat-style player with play/pause + pseudo-waveform
  // + duration. Falls through to the file/download card for any other
  // mime (pdf, docx, etc.).
  if (mimeType.startsWith('audio/') || media.kind === 'audio') {
    return <AudioPlayer src={media.url} seed={media.id} />
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      class="bp-media-file"
      download={media.name}
    >
      <div class="bp-media-file__icon">
        <IconFile />
      </div>
      <span class="bp-media-file__name">{media.name}</span>
      <span class="bp-media-file__download">
        <IconDownload />
      </span>
    </a>
  )
}
