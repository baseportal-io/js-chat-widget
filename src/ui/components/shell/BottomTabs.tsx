/** @jsxImportSource preact */

import type { Translations } from '../../i18n'
import { IconHelpCircle, IconHome, IconMessageSquare } from '../../icons'

export type Tab = 'home' | 'msgs' | 'help'

interface BottomTabsProps {
  active: Tab
  onChange: (tab: Tab) => void
  unreadCount: number
  showHelp: boolean
  t: Translations
}

/**
 * Three-tab footer (Home / Messages / Help). The Help tab is hidden
 * when the channel has no KB linked — there's nothing to show. The
 * Messages tab carries the unread badge.
 */
export function BottomTabs({ active, onChange, unreadCount, showHelp, t }: BottomTabsProps) {
  const tabs: Array<{ id: Tab; label: string; Icon: () => any; visible: boolean }> = [
    { id: 'home', label: t.tabs.home, Icon: IconHome, visible: true },
    { id: 'msgs', label: t.tabs.messages, Icon: IconMessageSquare, visible: true },
    { id: 'help', label: t.tabs.help, Icon: IconHelpCircle, visible: showHelp },
  ]

  const visibleTabs = tabs.filter((t) => t.visible)

  return (
    <div
      class="bp-wtabs"
      style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}
    >
      {visibleTabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          class={`bp-wtabs__btn ${active === id ? 'is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon />
          {label}
          {id === 'msgs' && unreadCount > 0 && (
            <span class="bp-wtabs__count">{unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}
