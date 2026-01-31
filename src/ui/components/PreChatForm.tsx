/** @jsxImportSource preact */

import { useState } from 'preact/hooks'

import type { ChannelInfo } from '../../api/types'
import type { Translations } from '../i18n'

interface PreChatFormProps {
  channelInfo: ChannelInfo
  onSubmit: (data: { name?: string; email?: string }) => void
  loading: boolean
  t: Translations
}

export function PreChatForm({
  channelInfo,
  onSubmit,
  loading,
  t,
}: PreChatFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const { requireName, requireEmail, privacyPolicyUrl } = channelInfo.config

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    onSubmit({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    })
  }

  const isValid =
    (!requireName || name.trim()) && (!requireEmail || email.trim())

  return (
    <form class="bp-prechat" onSubmit={handleSubmit}>
      <div class="bp-prechat__title">{t.prechat.title}</div>
      <div class="bp-prechat__desc">{t.prechat.description}</div>

      {requireName && (
        <div class="bp-prechat__field">
          <label class="bp-prechat__label">{t.prechat.name}</label>
          <input
            class="bp-prechat__input"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={t.prechat.namePlaceholder}
            required
          />
        </div>
      )}

      {requireEmail && (
        <div class="bp-prechat__field">
          <label class="bp-prechat__label">{t.prechat.email}</label>
          <input
            class="bp-prechat__input"
            type="email"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder={t.prechat.emailPlaceholder}
            required
          />
        </div>
      )}

      <button
        class="bp-prechat__submit"
        type="submit"
        disabled={!isValid || loading}
      >
        {loading ? t.prechat.loading : t.prechat.start}
      </button>

      {privacyPolicyUrl && (
        <div class="bp-prechat__privacy">
          {t.prechat.privacyPrefix}{' '}
          <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
            {t.prechat.privacyLink}
          </a>
        </div>
      )}
    </form>
  )
}
