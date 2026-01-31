/** @jsxImportSource preact */

import type { ChannelInfo, Conversation } from '../../api/types'
import { IconPlus } from '../icons'
import type { Translations } from '../i18n'

interface ConversationListProps {
  conversations: Conversation[]
  channelInfo: ChannelInfo
  loading: boolean
  onSelect: (conversation: Conversation) => void
  onNew: () => void
  t: Translations
}

export function ConversationList({
  conversations,
  channelInfo,
  loading,
  onSelect,
  onNew,
  t,
}: ConversationListProps) {
  const hasOpen = conversations.some((c) => c.open)
  const canReopen = channelInfo.config.allowReopenConversation

  if (loading) {
    return (
      <div class="bp-loading">
        <div class="bp-spinner" />
      </div>
    )
  }

  return (
    <div class="bp-convlist">
      {!hasOpen && (
        <div class="bp-convlist__new">
          <button class="bp-convlist__new-btn" onClick={onNew}>
            <IconPlus />
            {t.conversations.newConversation}
          </button>
        </div>
      )}

      <div class="bp-convlist__items">
        {conversations.length === 0 ? (
          <div class="bp-convlist__empty">{t.conversations.empty}</div>
        ) : (
          conversations.map((conv) => {
            const isClickable = conv.open || canReopen

            return (
              <button
                key={conv.id}
                class="bp-convlist__item"
                onClick={() => isClickable && onSelect(conv)}
                disabled={!isClickable}
              >
                <div class="bp-convlist__item-top">
                  <span class="bp-convlist__item-title">
                    {channelInfo.name}
                  </span>
                  <span
                    class={`bp-convlist__item-status ${conv.open ? 'bp-convlist__item-status--open' : 'bp-convlist__item-status--closed'}`}
                  >
                    {conv.open ? t.conversations.open : t.conversations.closed}
                  </span>
                </div>
                <span class="bp-convlist__item-preview">
                  {conv.lastMessage?.content || t.conversations.noMessages}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
