/** @jsxImportSource preact */

import type { ComponentChildren } from 'preact'

import { IconArrowLeft, IconX } from '../../icons'

interface HeaderNavProps {
  onBack: () => void
  onClose?: () => void
  children: ComponentChildren
}

/**
 * Navigation header used inside detail views (chat, article). The
 * back button is the primary affordance; the close button is shown
 * on the right so the visitor can dismiss the widget without
 * unwinding the stack.
 */
export function HeaderNav({ onBack, onClose, children }: HeaderNavProps) {
  return (
    <div class="bp-wh-nav">
      <button class="bp-wh-nav__back" onClick={onBack} aria-label="Back">
        <IconArrowLeft />
      </button>
      <span class="bp-wh-nav__title">{children}</span>
      {onClose && (
        <button class="bp-wh-nav__close" onClick={onClose} aria-label="Close">
          <IconX />
        </button>
      )}
    </div>
  )
}
