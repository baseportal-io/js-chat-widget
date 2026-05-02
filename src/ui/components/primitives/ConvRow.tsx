/** @jsxImportSource preact */

import type { Translations } from '../../i18n'
import { IconChevron } from '../../icons'
import { Avatar } from './Avatar'

interface ConvRowProps {
  id: string
  name: string
  preview: string
  time: string
  unread: number
  status?: 'open' | 'closed'
  avatarSeed: string
  avatarInitials: string
  onClick: () => void
  t: Translations
}

export function ConvRow({
  name,
  preview,
  time,
  unread,
  status,
  avatarSeed,
  avatarInitials,
  onClick,
  t,
}: ConvRowProps) {
  return (
    <button class="bp-wconv" onClick={onClick}>
      <div class="bp-wconv__avs">
        <Avatar initials={avatarInitials} variantSeed={avatarSeed} />
      </div>
      <div class="bp-wconv__body">
        <div class="bp-wconv__head">
          <span class="bp-wconv__name">{name}</span>
          <span class="bp-wconv__time">{time}</span>
        </div>
        <div class="bp-wconv__last">{preview}</div>
        {status && (
          <span class={`bp-wconv__status bp-wconv__status--${status}`}>
            <span class="bp-dot" />
            {status === 'open' ? t.messages.statusOpen : t.messages.statusClosed}
          </span>
        )}
      </div>
      <span class="bp-wconv__chev">
        <IconChevron />
      </span>
      {unread > 0 && <div class="bp-wconv__pin">{unread}</div>}
    </button>
  )
}
