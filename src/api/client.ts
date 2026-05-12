import type {
  Article,
  ArticleSummary,
  ChannelInfo,
  Conversation,
  Message,
} from "./types";

// Hard-coded so embedders can't point the widget at a rogue host.
// If you need to test against a non-production API, change this
// constant in source and rebuild — there's no SDK-level override.
//
// Reviewer note: this line previously got committed pointing at
// `localhost:3333` from a dev session. Production deploys MUST keep
// the `https://api.baseportal.io/...` value — every PR touching this
// file is expected to leave the URL on the live API.
const API_BASE = "https://api.baseportal.io/public/chat";

export class ApiClient {
  private baseUrl: string;
  private channelToken: string;
  private visitorEmail?: string;
  private visitorHash?: string;
  private visitorTs?: number;

  constructor(channelToken: string) {
    this.channelToken = channelToken;
    this.baseUrl = API_BASE;
  }

  setVisitorIdentity(email: string, hash?: string, ts?: number): void {
    this.visitorEmail = email;
    this.visitorHash = hash;
    this.visitorTs = ts;
  }

  clearVisitorIdentity(): void {
    this.visitorEmail = undefined;
    this.visitorHash = undefined;
    this.visitorTs = undefined;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "x-channel-token": this.channelToken,
    };
    if (this.visitorEmail) h["x-visitor-email"] = this.visitorEmail;
    if (this.visitorHash) h["x-visitor-hash"] = this.visitorHash;
    // ts only matters for v2 verification; harmless on v1 (the API
    // ignores extra headers). Sending it always keeps the widget
    // version-agnostic — the channel decides which scheme to apply.
    if (this.visitorTs !== undefined)
      h["x-visitor-ts"] = String(this.visitorTs);
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[BaseportalChat] API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async getChannelInfo(): Promise<ChannelInfo> {
    return this.request("GET", "/channel-info");
  }

  /**
   * Widget-start identity sync. The server creates or updates the
   * matching Client per the channel's `clientSyncMode` and always
   * responds `{ ok: true }`. Failures here are non-fatal — the widget
   * stays usable even if identify fails (e.g. rate-limited / offline).
   */
  async identify(data: {
    email?: string;
    phoneNumber?: string;
    name?: string;
    metadata?: Record<string, unknown>;
    ts?: number;
  }): Promise<{ ok: boolean }> {
    return this.request("POST", "/identify", data);
  }

  async initConversation(data: {
    name?: string;
    email?: string;
  }): Promise<Conversation & { messages?: Message[] }> {
    return this.request("POST", "/conversations", {
      ...data,
      channelToken: this.channelToken,
    });
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    return this.request("GET", `/conversations/${conversationId}`);
  }

  async getMessages(
    conversationId: string,
    params?: { limit?: number; page?: number },
  ): Promise<Message[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(
      "GET",
      `/conversations/${conversationId}/messages${query}`,
    );
  }

  async uploadFile(
    conversationId: string,
    file: File,
  ): Promise<{ id: string; url: string; name: string; mimeType: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {
      "x-channel-token": this.channelToken,
    };
    if (this.visitorEmail) headers["x-visitor-email"] = this.visitorEmail;
    if (this.visitorHash) headers["x-visitor-hash"] = this.visitorHash;
    if (this.visitorTs !== undefined)
      headers["x-visitor-ts"] = String(this.visitorTs);

    const res = await fetch(
      `${this.baseUrl}/conversations/${conversationId}/upload`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[BaseportalChat] Upload error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async sendMessage(
    conversationId: string,
    data: { content?: string; mediaId?: string },
  ): Promise<Message> {
    return this.request(
      "POST",
      `/conversations/${conversationId}/messages`,
      data,
    );
  }

  async getVisitorConversations(): Promise<Conversation[]> {
    return this.request("GET", "/conversations");
  }

  async reopenConversation(conversationId: string): Promise<Conversation> {
    return this.request("POST", `/conversations/${conversationId}/reopen`);
  }

  async getAblyToken(conversationId: string): Promise<unknown> {
    return this.request("POST", "/ably-token", { conversationId });
  }

  /**
   * Issues a token scoped to the visitor's per-contact notification
   * channel `visitor-{contactId}`. Used by the widget shell's
   * `VisitorRealtimeClient` to subscribe regardless of which
   * conversation the visitor has open — the floating-preview overlay
   * and the global notification sound rely on this stream.
   *
   * Requires identity verification (same headers as `/automation-pending`).
   * Throws when the channel hasn't been verified yet, in which case
   * the caller should silently skip subscribing.
   */
  async getVisitorAblyToken(): Promise<unknown> {
    return this.request("POST", "/visitor-ably-token");
  }

  /**
   * Search published articles in the channel's linked KB. Pass empty
   * `search` to get the top-viewed articles (used by the Help tab's
   * default "Most read" section). Returns [] when no KB is linked.
   */
  async searchArticles(
    search?: string,
    limit?: number,
  ): Promise<ArticleSummary[]> {
    const qs = new URLSearchParams();
    if (search && search.trim().length > 0) qs.set("search", search.trim());
    if (limit) qs.set("limit", String(limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/articles${query}`);
  }

  async getArticle(slug: string): Promise<Article> {
    return this.request("GET", `/articles/${encodeURIComponent(slug)}`);
  }

  async rateArticle(slug: string, helpful: boolean): Promise<{ ok: boolean }> {
    return this.request("POST", `/articles/${encodeURIComponent(slug)}/rate`, {
      helpful,
    });
  }

  /**
   * Reports an SPA navigation event so the API can fire PAGE_VISITED automation
   * triggers. `enter` opens a view; `leave` closes the most recent open view
   * for the same path and computes its dwell time. Failures are silent — page
   * tracking is best-effort and never blocks the widget UI.
   */
  async trackPage(data: {
    path: string;
    query?: string;
    referrer?: string;
    action: "enter" | "leave";
  }): Promise<void> {
    try {
      await this.request("POST", "/visitor-pages", data);
    } catch {
      // best-effort
    }
  }

  /**
   * Drain pending modal deliveries. Called on widget connect (and after
   * reconnect) so a modal queued while the visitor was offline still
   * gets shown. Backend filters by the verified visitor identity; we
   * ship up nothing extra. Returns `[]` when not identified.
   */
  async getPendingModals(): Promise<{
    deliveries: Array<{
      deliveryId: string;
      sourceType: "automation" | "campaign" | "manual";
      automationId: string | null;
      campaignId: string | null;
      modal: {
        id: string;
        size: "small" | "medium" | "large" | "custom";
        customWidth: string | null;
        customMaxHeight: string | null;
        content: string | null;
        mobileContent: string | null;
        includePaths: string[];
        excludePaths: string[];
        displayMode: "always" | "once" | "until_dismissed" | "limited";
        frameConfig: {
          backgroundColor?: string;
          borderRadius?: number;
          borderColor?: string | null;
          borderWidth?: number;
          padding?: number;
          backgroundImageUrl?: string | null;
          mobileBackgroundImageUrl?: string | null;
        } | null;
      };
    }>;
  }> {
    try {
      return await this.request("GET", "/pending-modals");
    } catch {
      return { deliveries: [] };
    }
  }

  /**
   * Lifecycle event postback. Best-effort — a network error here only
   * loses analytics fidelity, not correctness (the visitor still sees
   * the modal exactly once because the row stays `pending` and the
   * frequency cap counts only `shown` rows; a `shown` event that never
   * lands just means the row remains `pending` and could redeliver,
   * which is the safer side to err on UX-wise).
   */
  async postModalEvent(
    deliveryId: string,
    event: "shown" | "dismissed" | "clicked" | "opt_out",
  ): Promise<void> {
    try {
      await this.request(
        "POST",
        `/modal-deliveries/${encodeURIComponent(deliveryId)}/event`,
        { event },
      );
    } catch {
      // best-effort
    }
  }

  /**
   * Drain undelivered chat-side notifications (admin/automation/
   * campaign messages that were published while the visitor was
   * offline). Returns the latest one + a count; the server marks all
   * of them as delivered so the next call returns `count: 0` until
   * something new arrives. Best-effort — silent fallback on error
   * since this only feeds the boot notification UX.
   */
  async getPendingNotifications(): Promise<{
    count: number;
    latest: {
      text: "new_message_notification";
      conversationId: string;
      messageId: string;
      preview: string;
      previewImageUrl: string | null;
      from: { name: string | null; avatarUrl: string | null };
      createdAt: string;
      source: string | null;
      automationId: string | null;
      campaignId: string | null;
    } | null;
  }> {
    try {
      return await this.request("GET", "/pending-notifications");
    } catch {
      return { count: 0, latest: null };
    }
  }
}
