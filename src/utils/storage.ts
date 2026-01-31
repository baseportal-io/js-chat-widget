import type { VisitorData } from '../api/types'

interface StoredData {
  conversationId?: string
  visitor?: VisitorData
}

export class Storage {
  private prefix: string

  constructor(channelToken: string, email?: string) {
    this.prefix = email
      ? `bp_chat_${channelToken}_${email}`
      : `bp_chat_${channelToken}`
  }

  get(): StoredData {
    try {
      const raw = localStorage.getItem(this.prefix)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  set(data: Partial<StoredData>): void {
    try {
      const current = this.get()
      localStorage.setItem(this.prefix, JSON.stringify({ ...current, ...data }))
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }

  getConversationId(): string | undefined {
    return this.get().conversationId
  }

  setConversationId(id: string): void {
    this.set({ conversationId: id })
  }

  getVisitor(): VisitorData | undefined {
    return this.get().visitor
  }

  setVisitor(visitor: VisitorData): void {
    this.set({ visitor })
  }

  clear(): void {
    try {
      localStorage.removeItem(this.prefix)
    } catch {
      // ignore
    }
  }
}
