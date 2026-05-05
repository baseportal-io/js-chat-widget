/** @jsxImportSource preact */

import { useState } from 'preact/hooks'

import type { VisitorNotificationPayload } from '../../realtime/visitor-realtime-client'
import { IconX } from '../icons'

export interface PendingPreview {
  /** Stable id used to dedupe rapid-fire notifications + key the DOM node. */
  id: string
  conversationId: string
  preview: string
  /**
   * Resolved http(s) URL of the first inline image in the message
   * body, or null when the message is text-only. Renders as a
   * thumbnail next to the snippet so a campaign image is visible
   * even with the widget collapsed.
   */
  previewImageUrl: string | null
  fromName: string | null
  fromAvatarUrl: string | null
  /** Wall-clock when received — drives the auto-dismiss countdown. */
  receivedAt: number
}

export function notificationToPreview(
  payload: VisitorNotificationPayload
): PendingPreview {
  return {
    id: payload.messageId,
    conversationId: payload.conversationId,
    preview: payload.preview,
    previewImageUrl: payload.previewImageUrl,
    fromName: payload.from.name,
    fromAvatarUrl: payload.from.avatarUrl,
    receivedAt: Date.now(),
  }
}

interface FloatingPreviewProps {
  previews: PendingPreview[]
  /**
   * Called when the visitor clicks the preview body. The shell opens
   * the widget and routes to the chat view of that conversation.
   */
  onOpen: (preview: PendingPreview) => void
  /** Visitor explicitly closed the card (X button). */
  onDismiss: (id: string) => void
  position?: 'bottom-right' | 'bottom-left'
}

/**
 * Instagram-style floating preview stacked above the FAB. Renders
 * outside the widget shell so it's visible even when the widget is
 * minimised. Stays in the DOM until either:
 *
 *   - The visitor clicks the body → opens the widget on that
 *     conversation (parent calls `onOpen` then drops the preview).
 *   - The visitor clicks the X → `onDismiss`.
 *
 * No auto-dismiss timer — the previous 8-second auto-close was
 * deliberately removed because tester feedback was that it disappeared
 * before the visitor noticed it. Letting it sit until acknowledged
 * matches the Slack / Intercom UX. The stack-limit guard below
 * prevents an unbounded backlog from covering the page chrome.
 *
 * Multiple notifications stack vertically (most recent on top). We
 * cap the on-screen count to 3 to avoid the layer from growing past
 * the visible viewport.
 */
const STACK_LIMIT = 3

export function FloatingPreview({
  previews,
  onOpen,
  onDismiss,
  position = 'bottom-right',
}: FloatingPreviewProps) {
  if (previews.length === 0) return null
  const visible = previews.slice(-STACK_LIMIT)

  return (
    <div class={`bp-floating-preview-layer bp-floating-preview-layer--${position}`}>
      {visible.map((p) => (
        <PreviewCard
          key={p.id}
          preview={p}
          onOpen={() => onOpen(p)}
          onDismiss={() => onDismiss(p.id)}
        />
      ))}
    </div>
  )
}

function PreviewCard({
  preview,
  onOpen,
  onDismiss,
}: {
  preview: PendingPreview
  onOpen: () => void
  onDismiss: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const initial = (preview.fromName?.[0] || 'A').toUpperCase()

  return (
    <div
      class={`bp-floating-preview ${pressed ? 'bp-floating-preview--pressed' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <button
        type="button"
        class="bp-floating-preview__body"
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onClick={onOpen}
      >
        <div class="bp-floating-preview__avatar">
          {preview.fromAvatarUrl ? (
            <img src={preview.fromAvatarUrl} alt="" />
          ) : (
            initial
          )}
        </div>
        <div class="bp-floating-preview__text">
          {preview.fromName && (
            <div class="bp-floating-preview__name">{preview.fromName}</div>
          )}
          <div class="bp-floating-preview__snippet">{preview.preview}</div>
        </div>
        {preview.previewImageUrl && (
          <img
            class="bp-floating-preview__thumb"
            src={preview.previewImageUrl}
            alt=""
            loading="lazy"
          />
        )}
      </button>
      <button
        type="button"
        class="bp-floating-preview__close"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        aria-label="Fechar"
      >
        <IconX />
      </button>
    </div>
  )
}
