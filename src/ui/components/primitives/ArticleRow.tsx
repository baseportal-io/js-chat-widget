/** @jsxImportSource preact */

import type { ArticleSummary } from '../../../api/types'
import type { Translations } from '../../i18n'
import { formatT } from '../../i18n'
import { IconBookOpen, IconChevron } from '../../icons'

interface ArticleRowProps {
  article: ArticleSummary
  onClick: () => void
  t: Translations
}

export function ArticleRow({ article, onClick, t }: ArticleRowProps) {
  const minLabel =
    article.mins <= 1 ? t.article.minRead : formatT(t.article.minsRead, { mins: article.mins })

  return (
    <button class="bp-warticle" onClick={onClick}>
      <div class="bp-warticle__icon">
        <IconBookOpen />
      </div>
      <div class="bp-warticle__body">
        <div class="bp-warticle__title">{article.title}</div>
        {article.summary && <div class="bp-warticle__sub">{article.summary}</div>}
        <div class="bp-warticle__meta">
          <span>{minLabel}</span>
        </div>
      </div>
      <span class="bp-warticle__chev">
        <IconChevron />
      </span>
    </button>
  )
}
