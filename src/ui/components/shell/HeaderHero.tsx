/** @jsxImportSource preact */

import type { ChannelAdmin } from '../../../api/types'
import type { Translations } from '../../i18n'
import { formatT } from '../../i18n'
import { IconSearch, IconX } from '../../icons'
import { Avatar } from '../primitives/Avatar'

interface HeaderHeroProps {
  channelName: string
  visitorName?: string
  administrators: ChannelAdmin[]
  responseTimeSeconds: number | null
  onClose: () => void
  /** Optional inline search shown on the gradient. The HomeView
   *  passes this so the bar lives inside the hero (avoids the
   *  z-index / stacking-context fragility of overlapping it from
   *  the body via margin-top: -22px). */
  search?: {
    value: string
    onInput: (v: string) => void
    placeholder: string
  }
  t: Translations
}

/**
 * Hero header for the Home tab. Renders the gradient background with
 * a personalised greeting and the crew strip (admin avatars + online
 * meta). Hidden when no admins are configured for the channel.
 */
export function HeaderHero({
  visitorName,
  administrators,
  responseTimeSeconds,
  onClose,
  search,
  t,
}: HeaderHeroProps) {
  const greeting = visitorName
    ? formatT(t.home.helloName, { name: visitorName })
    : t.home.helloFallback

  const crewVisible = administrators.length > 0
  const onlineCount = administrators.filter((a) => a.isOnline).length
  const crewMain = onlineCount > 0 ? t.home.teamOnline : t.home.teamOffline

  return (
    <div class="bp-wh bp-wh--gradient">
      <button class="bp-wh__close" onClick={onClose} aria-label="Close">
        <IconX />
      </button>
      <div class="bp-wh__hero">
        <h1 class="bp-wh__hello">
          {greeting}
          <span> 👋</span>
          <br />
          <b>{t.home.howCanWeHelp}</b>
        </h1>
        {crewVisible && (
          <div class="bp-wh__crew">
            <div class="bp-wh__avs">
              {administrators.slice(0, 3).map((a) => (
                <Avatar
                  key={a.id}
                  initials={initials(a.firstName, a.lastName)}
                  imageUrl={a.avatarUrl}
                  variantSeed={a.id}
                  online={a.isOnline}
                />
              ))}
            </div>
            <div class="bp-wh__crew-meta">
              <b>{crewMain}</b>
              {formatResponseTime(responseTimeSeconds, t)}
            </div>
          </div>
        )}
      </div>
      {search && (
        <div class="bp-wh__search">
          <IconSearch />
          <input
            type="text"
            value={search.value}
            onInput={(e) =>
              search.onInput((e.target as HTMLInputElement).value)
            }
            placeholder={search.placeholder}
          />
        </div>
      )}
    </div>
  )
}

function initials(first?: string, last?: string): string {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?'
}

function formatResponseTime(seconds: number | null, t: Translations): string {
  if (seconds === null || seconds <= 0) return t.home.typicallyReplies
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins <= 1) return t.home.responseInUnderMin
  if (mins >= 60) return t.home.responseInUnderHour
  return formatT(t.home.responseInUnderMins, { mins })
}
