import * as Ably from 'ably'

import type { ApiClient } from '../api/client'
import type { Conversation, Message } from '../api/types'

export interface RealtimeHandlers {
  onMessage: (message: Message) => void
  onConversationStatusUpdate: (conversation: Conversation) => void
}

export class RealtimeClient {
  private client: Ably.Realtime | null = null
  private channel: Ably.RealtimeChannel | null = null
  private conversationId: string | null = null
  private apiClient: ApiClient
  private handlers: RealtimeHandlers | null = null

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  async subscribe(
    conversationId: string,
    handlers: RealtimeHandlers
  ): Promise<void> {
    // Unsubscribe from previous if any
    this.unsubscribe()

    this.conversationId = conversationId
    this.handlers = handlers

    try {
      const tokenRequest = await this.apiClient.getAblyToken(conversationId)

      this.client = new Ably.Realtime({
        authCallback: (_data, callback) => {
          callback(null, tokenRequest as Ably.TokenRequest)
        },
        clientId: `visitor-${conversationId}`,
      })

      const channelName = `conversation-${conversationId}`
      this.channel = this.client.channels.get(channelName)

      this.channel.subscribe((msg) => {
        if (!msg.data) return

        try {
          const data =
            typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data

          if (data.text === 'conversation_status_updated' && data.metadata) {
            handlers.onConversationStatusUpdate(data.metadata as Conversation)
          } else if (
            data.text === 'created_or_updated_message' &&
            data.metadata
          ) {
            handlers.onMessage(data.metadata as Message)
          }
        } catch (e) {
          console.error('[BaseportalChat] Error parsing realtime message:', e)
        }
      })
    } catch (e) {
      console.error('[BaseportalChat] Error connecting to realtime:', e)
    }
  }

  unsubscribe(): void {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    if (this.client) {
      this.client.close()
      this.client = null
    }
    this.conversationId = null
    this.handlers = null
  }

  isConnected(): boolean {
    return this.client?.connection.state === 'connected'
  }
}
