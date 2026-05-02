/** @jsxImportSource preact */

import { IconX } from '../../icons'

interface HeaderSolidProps {
  title: string
  subtitle?: string
  onClose: () => void
}

/**
 * Solid (single-color) header used by the Messages and Help tabs.
 * The hero gradient is reserved for Home; Messages/Help use this
 * lighter variant so the body has more visual room.
 */
export function HeaderSolid({ title, subtitle, onClose }: HeaderSolidProps) {
  return (
    <div class="bp-wh bp-wh--solid">
      <button class="bp-wh__close" onClick={onClose} aria-label="Close">
        <IconX />
      </button>
      <h1 class="bp-wh__title">{title}</h1>
      {subtitle && <p class="bp-wh__sub">{subtitle}</p>}
    </div>
  )
}
