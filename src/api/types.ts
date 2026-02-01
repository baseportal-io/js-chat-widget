export interface ChannelInfo {
  id: string
  name: string
  config: {
    requireEmail: boolean
    requireName: boolean
    allowViewHistory: boolean
    allowReopenConversation: boolean
    privacyPolicyUrl: string | null
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
  hash?: string
  metadata?: Record<string, string>
}

export interface BaseportalChatConfig {
  channelToken: string
  apiUrl?: string
  position?: 'bottom-right' | 'bottom-left'
  theme?: { primaryColor?: string }
  visitor?: VisitorData
  container?: HTMLElement
  hideOnLoad?: boolean
  locale?: 'pt' | 'en' | 'es'
}
