/** @jsxImportSource preact */

import { useEffect, useState } from 'preact/hooks'

import type { ApiClient } from '../../../api/client'
import type {
  ArticleSummary,
  ChannelInfo,
  Conversation,
} from '../../../api/types'
import type { Translations } from '../../i18n'
import { IconSend } from '../../icons'
import { ArticleRow } from '../primitives/ArticleRow'
import { ConvRow } from '../primitives/ConvRow'
import { SectionHead } from '../primitives/SectionHead'

interface HomeViewProps {
  channelInfo: ChannelInfo
  visitorName?: string
  /**
   * Every conversation the visitor has open (most recent first). The
   * Home tab renders all of them under "Continue de onde parou" — a
   * change from the previous "show only the latest" behaviour, which
   * masked parallel automation threads (each automation gets its own
   * conversation now, so a visitor in two campaigns plus a human chat
   * had three threads but only saw one).
   */
  openConversations: Conversation[]
  onStartConversation: () => void
  onOpenConversation: (id: string) => void
  onOpenArticle: (slug: string) => void
  onGoToHelp: () => void
  apiClient: ApiClient
  /** Search state lifted to ChatWindow so the header can render it
   *  inside the gradient (see HeaderHero `search` prop). */
  search: string
  onSearchChange: (value: string) => void
  t: Translations
}

/**
 * Home tab body. Pinned content on top of the gradient hero:
 *   - Search bar (jumps to Help tab on submit)
 *   - "Start a conversation" CTA with the avg response time
 *   - Continue where left off (most recent open conversation, if any)
 *   - Recommended articles (top 3 from channel.recommendedArticles)
 *
 * Each section short-circuits when there's no data, so a brand new
 * channel without a KB or history shows just the CTA.
 */
export function HomeView({
  channelInfo,
  openConversations,
  onStartConversation,
  onOpenConversation,
  onOpenArticle,
  onGoToHelp,
  apiClient,
  search,
  t,
}: HomeViewProps) {
  const recommendedArticles: ArticleSummary[] = channelInfo.recommendedArticles || []
  const responseSubtext = formatResponseSubtext(channelInfo.responseTime?.seconds ?? null, t)

  const trimmedSearch = search.trim()
  const isSearching = trimmedSearch.length > 0

  // Inline article search on Home. Replaces the static landing
  // sections (start CTA, continue, recommended) with live results
  // so the visitor doesn't lose focus by tab-switching mid-keystroke.
  // Debounced to avoid hammering the API as the user types.
  const [searchResults, setSearchResults] = useState<ArticleSummary[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const results = await apiClient.searchArticles(trimmedSearch, 10)
        if (!cancelled) setSearchResults(results)
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [trimmedSearch, isSearching, apiClient])

  if (isSearching) {
    return (
      <div class="bp-wb">
        {searching && searchResults.length === 0 ? (
          <div class="bp-loading" style={{ padding: 32 }}>
            <div class="bp-spinner" />
          </div>
        ) : searchResults.length === 0 ? (
          <div class="bp-wempty">
            <h4>{t.help.noResults}</h4>
          </div>
        ) : (
          <>
            {searchResults.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                onClick={() => onOpenArticle(article.slug)}
                t={t}
              />
            ))}
            <div style={{ padding: '12px 16px' }}>
              <button
                class="bp-wsec__more"
                style={{ display: 'block', textAlign: 'center', width: '100%' }}
                onClick={onGoToHelp}
              >
                {t.home.seeAll}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div class="bp-wb">
      <button class="bp-wstart" onClick={onStartConversation}>
        <div>
          <div>{t.home.startConversation}</div>
          {responseSubtext && <span class="bp-wstart__sub">{responseSubtext}</span>}
        </div>
        <IconSend />
      </button>

      {openConversations.length > 0 && (
        <>
          <SectionHead title={t.home.continueWhereLeftOff} />
          {openConversations.map((conv) => (
            <ConvRow
              key={conv.id}
              id={conv.id}
              name={previewSubject(conv)}
              preview={previewText(conv)}
              time={previewTime(conv)}
              unread={0}
              status={conv.open ? 'open' : 'closed'}
              avatarSeed={conv.id}
              avatarInitials={previewInitials(conv)}
              onClick={() => onOpenConversation(conv.id)}
              t={t}
            />
          ))}
        </>
      )}

      {recommendedArticles.length > 0 && (
        <>
          <SectionHead
            title={t.home.recommendedArticles}
            action={{ label: t.home.seeAll, onClick: onGoToHelp }}
          />
          {recommendedArticles.slice(0, 3).map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              onClick={() => onOpenArticle(article.slug)}
              t={t}
            />
          ))}
        </>
      )}
    </div>
  )
}

function formatResponseSubtext(seconds: number | null, t: Translations): string | null {
  if (seconds === null || seconds <= 0) return null
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins <= 1) return t.home.responseInUnderMin
  if (mins >= 60) return t.home.responseInUnderHour
  return t.home.responseInUnderMins.replace('{{mins}}', String(mins))
}

function previewSubject(conv: Conversation): string {
  // The widget doesn't carry per-conversation participant names yet;
  // fall back to a static channel name keyed by id so the row reads
  // sensibly. Real per-conv subject lands when the API exposes it.
  return conv.lastMessage?.user
    ? `${conv.lastMessage.user.firstName} ${conv.lastMessage.user.lastName}`
    : 'Conversa'
}

function previewText(conv: Conversation): string {
  return conv.lastMessage?.content || ''
}

function previewTime(conv: Conversation): string {
  if (!conv.updatedAt) return ''
  return relativeTime(new Date(conv.updatedAt))
}

function previewInitials(conv: Conversation): string {
  const u = conv.lastMessage?.user
  if (u) {
    return `${(u.firstName || '').charAt(0)}${(u.lastName || '').charAt(0)}`.toUpperCase() || '?'
  }
  return 'C'
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
