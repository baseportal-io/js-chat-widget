import type { ChannelInfo, Conversation, Message } from './types'

export class ApiClient {
  private baseUrl: string
  private channelToken: string
  private visitorEmail?: string
  private visitorHash?: string

  constructor(channelToken: string, apiUrl: string) {
    this.channelToken = channelToken
    this.baseUrl = `${apiUrl}/public/chat`
  }

  setVisitorIdentity(email: string, hash?: string): void {
    this.visitorEmail = email
    this.visitorHash = hash
  }

  clearVisitorIdentity(): void {
    this.visitorEmail = undefined
    this.visitorHash = undefined
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-channel-token': this.channelToken,
    }
    if (this.visitorEmail) h['x-visitor-email'] = this.visitorEmail
    if (this.visitorHash) h['x-visitor-hash'] = this.visitorHash
    return h
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`[BaseportalChat] API error ${res.status}: ${text}`)
    }

    return res.json()
  }

  async getChannelInfo(): Promise<ChannelInfo> {
    return this.request('GET', '/channel-info')
  }

  async initConversation(data: {
    name?: string
    email?: string
  }): Promise<Conversation & { messages?: Message[] }> {
    return this.request('POST', '/conversations', {
      ...data,
      channelToken: this.channelToken,
    })
  }

  async getMessages(
    conversationId: string,
    params?: { limit?: number; page?: number }
  ): Promise<Message[]> {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.page) qs.set('page', String(params.page))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return this.request('GET', `/conversations/${conversationId}/messages${query}`)
  }

  async sendMessage(
    conversationId: string,
    data: { content: string }
  ): Promise<Message> {
    return this.request(
      'POST',
      `/conversations/${conversationId}/messages`,
      data
    )
  }

  async getVisitorConversations(): Promise<Conversation[]> {
    return this.request('GET', '/conversations')
  }

  async reopenConversation(conversationId: string): Promise<Conversation> {
    return this.request('POST', `/conversations/${conversationId}/reopen`)
  }

  async getAblyToken(conversationId: string): Promise<unknown> {
    return this.request('POST', '/ably-token', { conversationId })
  }
}
