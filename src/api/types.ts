export interface ChannelInfo {
  id: string
  name: string
  config: {
    requireEmail: boolean
    requireName: boolean
    allowViewHistory: boolean
    allowReopenConversation: boolean
    privacyPolicyUrl: string | null
    /**
     * Auto-create / sync of Client records on widget start.
     * When `'off'`, the widget skips the `/identify` call entirely.
     */
    clientSyncMode: 'off' | 'create' | 'createOrUpdate'
    /**
     * Hash algorithm version for identity verification. v2 signs
     * `${subject}:${ts}` (replay-safe); v1 signs just the email
     * (legacy, kept for existing channels).
     */
    identityVerificationVersion: 1 | 2
  }
  hasIdentityVerification: boolean
  theme: {
    primaryColor: string | null
  }
}

export interface Conversation {
  id: string
  open: boolean
  channelId: string
  createdAt: string
  updatedAt: string
  lastMessage?: Message | null
}

export interface Message {
  id: string
  content: string
  role: 'client' | 'user'
  createdAt: string
  updatedAt: string
  isDeleted?: boolean
  user?: {
    id: string
    firstName: string
    lastName: string
    avatar?: { url: string } | null
  } | null
  media?: {
    id: string
    url: string
    name: string
    mimeType: string
    streamUrlData?: {
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
    } | null
    kind?: string
  } | null
}

export interface VisitorData {
  name?: string
  email?: string
  /** Optional fallback identifier when the team's login key is phone-based. */
  phoneNumber?: string
  hash?: string
  /**
   * v2 hashes are bound to a timestamp. The embedder generates `ts`
   * server-side alongside the hash and passes both. Omitted for v1.
   */
  ts?: number
  /**
   * Custom field values keyed by the team's `user_custom_fields.name`.
   * Loosely typed — the API enforces per-channel allowlists and per-key
   * length caps before persisting.
   */
  metadata?: Record<string, unknown>
}

export interface BaseportalChatConfig {
  channelToken: string
  position?: 'bottom-right' | 'bottom-left'
  theme?: { primaryColor?: string }
  visitor?: VisitorData
  container?: HTMLElement
  hideOnLoad?: boolean
  locale?: 'pt' | 'en' | 'es'
}
