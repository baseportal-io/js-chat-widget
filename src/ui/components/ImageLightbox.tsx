/** @jsxImportSource preact */

import { useCallback, useEffect } from 'preact/hooks'

import { IconX } from '../icons'

interface ImageLightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div class="bp-lightbox" onClick={onClose}>
      <button class="bp-lightbox__close" onClick={onClose}>
        <IconX />
      </button>
      <img
        src={src}
        alt={alt || ''}
        class="bp-lightbox__img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
