/** @jsxImportSource preact */

import { useEffect, useState } from 'preact/hooks'

import type { ApiClient } from '../../../api/client'
import type { ArticleSummary } from '../../../api/types'
import type { Translations } from '../../i18n'
import { ArticleRow } from '../primitives/ArticleRow'
import { SearchBar } from '../primitives/SearchBar'
import { SectionHead } from '../primitives/SectionHead'

interface HelpViewProps {
  apiClient: ApiClient
  onOpenArticle: (slug: string) => void
  t: Translations
}

/**
 * Help tab body. Renders a debounced search at the top; when the
 * query is empty we show the channel's most-read articles. We
 * deliberately don't render KB collections (categories) yet — first
 * version focuses on search + popular, the way the design has them
 * in V1.
 */
export function HelpView({ apiClient, onOpenArticle, t }: HelpViewProps) {
  const [search, setSearch] = useState('')
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Debounce search but skip the timer when the field is empty so
    // the initial "popular" load doesn't lag.
    const handle = setTimeout(
      async () => {
        try {
          const result = await apiClient.searchArticles(search || undefined, 20)
          if (!cancelled) setArticles(result)
        } catch (e) {
          if (!cancelled) setArticles([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      search ? 250 : 0
    )

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [search, apiClient])

  const showingPopular = search.trim().length === 0

  return (
    <div class="bp-wb bp-wb--white">
      <SearchBar
        value={search}
        onInput={setSearch}
        placeholder={t.help.searchPlaceholder}
        variant="inline"
      />

      {showingPopular && articles.length > 0 && <SectionHead title={t.help.popular} />}

      {loading ? (
        <div class="bp-loading">
          <div class="bp-spinner" />
        </div>
      ) : articles.length === 0 ? (
        <div class="bp-wempty">
          <h4>{showingPopular ? t.help.noArticles : t.help.noResults}</h4>
        </div>
      ) : (
        articles.map((a) => (
          <ArticleRow
            key={a.id}
            article={a}
            onClick={() => onOpenArticle(a.slug)}
            t={t}
          />
        ))
      )}
    </div>
  )
}
