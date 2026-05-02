/** @jsxImportSource preact */

import { useEffect, useState } from 'preact/hooks'

import type { ApiClient } from '../../../api/client'
import type { Article, KnowledgeBaseInfo } from '../../../api/types'
import type { Translations } from '../../i18n'
import { formatT } from '../../i18n'
import { IconExternal, IconThumbDown, IconThumbUp } from '../../icons'

interface ArticleViewProps {
  apiClient: ApiClient
  slug: string
  knowledgeBase: KnowledgeBaseInfo | null
  t: Translations
}

/**
 * Article reader. The article body is rendered as plain text
 * paragraphs split by blank lines — no HTML/markdown parsing here.
 * KB authors paste rich content into the admin editor (which strips
 * to a sane subset) and what comes back via the public endpoint is
 * already safe text. If we add inline HTML support later, sanitize
 * server-side first.
 */
export function ArticleView({ apiClient, slug, knowledgeBase, t }: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFeedback(null)
    apiClient
      .getArticle(slug)
      .then((a) => {
        if (!cancelled) setArticle(a)
      })
      .catch(() => {
        if (!cancelled) setArticle(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, apiClient])

  const handleRate = async (helpful: boolean) => {
    if (!article) return
    setFeedback(helpful ? 'helpful' : 'not_helpful')
    try {
      await apiClient.rateArticle(article.slug, helpful)
    } catch {
      // best-effort: keep the UI optimistic, don't roll back on a
      // transient error
    }
  }

  if (loading) {
    return (
      <div class="bp-loading">
        <div class="bp-spinner" />
      </div>
    )
  }

  if (!article) {
    return (
      <div class="bp-wempty">
        <h4>{t.help.noResults}</h4>
      </div>
    )
  }

  const minLabel =
    article.mins <= 1 ? t.article.minRead : formatT(t.article.minsRead, { mins: article.mins })

  const externalUrl = knowledgeBase?.kbSubdomain
    ? `https://${knowledgeBase.kbSubdomain}/articles/${article.slug}`
    : null

  return (
    <div class="bp-warticle-view">
      <div class="bp-warticle-view__meta">
        <span>{minLabel}</span>
      </div>
      <h1>{article.title}</h1>
      {article.summary && (
        <p class="bp-warticle-view__summary">{article.summary}</p>
      )}
      {/* The KB editor stores rich content as HTML and the API
          already resolves `file://<id>` placeholders into signed R2
          URLs. We render that HTML directly into the body — same
          model the public KB site uses; the trust boundary is the
          team's own admins. If we later sanitize on the public KB
          side, mirror the change here. */}
      <div
        class="bp-warticle-view__body"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {externalUrl && (
        <p>
          <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            <IconExternal /> {knowledgeBase?.name}
          </a>
        </p>
      )}

      <div class="bp-warticle-view__feedback">
        {feedback ? (
          <p class="bp-warticle-view__feedback-q">{t.article.feedbackThanks}</p>
        ) : (
          <>
            <p class="bp-warticle-view__feedback-q">{t.article.feedbackQuestion}</p>
            <div class="bp-warticle-view__feedback-btns">
              <button
                class="bp-warticle-view__feedback-btn"
                onClick={() => handleRate(true)}
              >
                <IconThumbUp /> {t.article.feedbackYes}
              </button>
              <button
                class="bp-warticle-view__feedback-btn"
                onClick={() => handleRate(false)}
              >
                <IconThumbDown /> {t.article.feedbackNo}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

