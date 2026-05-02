/** @jsxImportSource preact */

import type { Conversation } from '../../../api/types'
import type { Translations } from '../../i18n'
import { formatT } from '../../i18n'
import { ConvRow } from '../primitives/ConvRow'

interface MessagesViewProps {
  conversations: Conversation[]
  onOpen: (id: string) => void
  onNew: () => void
  t: Translations
}

/**
 * Messages tab body. Splits open/closed conversations into separate
 * groups (Em atendimento / Concluídas). The "+ Nova" affordance sits
 * on the open header.
 */
export function MessagesView({ conversations, onOpen, onNew, t }: MessagesViewProps) {
  const open = conversations.filter((c) => c.open)
  const closed = conversations.filter((c) => !c.open)

  if (conversations.length === 0) {
    return (
      <div class="bp-wb">
        <div class="bp-wempty">
          <h4>{t.messages.empty}</h4>
          <button
            class="bp-wstart"
            onClick={onNew}
            style={{ width: 'auto', display: 'inline-flex', marginTop: 16 }}
          >
            {t.home.startConversation}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="bp-wb">
      <div class="bp-wgrouph">
        {t.messages.inProgress}
        <button class="bp-wgrouph__action" onClick={onNew}>
          {t.messages.new}
        </button>
      </div>
      {open.length === 0 ? (
        <div class="bp-wempty" style={{ padding: '8px 20px 16px', textAlign: 'left' }}>
          <p>{t.messages.empty}</p>
        </div>
      ) : (
        open.map((c) => <Row key={c.id} c={c} onClick={() => onOpen(c.id)} t={t} />)
      )}

      {closed.length > 0 && (
        <>
          <div class="bp-wgrouph">
            {formatT(t.messages.subtitleCounts, { open: open.length, closed: closed.length })
              .split('·')[1]
              ?.trim() || `${closed.length} ${t.messages.completed}`}
          </div>
          {closed.map((c) => <Row key={c.id} c={c} onClick={() => onOpen(c.id)} t={t} />)}
        </>
      )}
    </div>
  )
}

function Row({ c, onClick, t }: { c: Conversation; onClick: () => void; t: Translations }) {
  const lastUser = c.lastMessage?.user
  const initials = lastUser
    ? `${(lastUser.firstName || '').charAt(0)}${(lastUser.lastName || '').charAt(0)}`.toUpperCase()
    : 'C'
  const name = lastUser ? `${lastUser.firstName} ${lastUser.lastName}` : 'Conversa'
  const preview = c.lastMessage?.content || t.conversations.noMessages
  const time = c.updatedAt ? relativeTime(new Date(c.updatedAt)) : ''

  return (
    <ConvRow
      id={c.id}
      name={name}
      preview={preview}
      time={time}
      unread={0}
      status={c.open ? 'open' : 'closed'}
      avatarSeed={c.id}
      avatarInitials={initials || '?'}
      onClick={onClick}
      t={t}
    />
  )
}

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'agora'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}
