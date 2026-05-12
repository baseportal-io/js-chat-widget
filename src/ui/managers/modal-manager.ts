import type { ModalPayload, VisitorModalShowPayload } from '../../realtime/visitor-realtime-client'
import { shouldShowOnPath } from '../../utils/path-matcher'

export interface QueuedModal {
  deliveryId: string
  modalId: string
  sourceType: 'automation' | 'campaign' | 'manual'
  automationId: string | null
  campaignId: string | null
  modal: ModalPayload
  // when the modal landed in the queue, used for FIFO ordering and TTL.
  queuedAt: number
}

// Modals stuck in the queue past this point are dropped — a visitor
// who never navigated to a matching path in 24h shouldn't suddenly see
// a stale 2-day-old modal next session. Server-side capping is the
// authoritative bound; client TTL is just to keep the in-memory queue
// from growing on a long-lived tab.
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

// Minimum gap between two consecutive modals shown to the same visitor.
// Without this guard, a visitor with multiple queued modals (a
// frequency-capped one + a fresh campaign push) could see modal #2
// flash up the moment they dismiss modal #1, which feels spammy and
// breaks the "never overlap" contract for users who skim-dismiss fast.
//
// 20s strikes the balance: long enough that the second modal feels
// like a separate beat, short enough that admins running a chained
// campaign + automation see both fire on a normal pageview without
// having to navigate first. Not configurable today — flatten to a
// single tuning knob until we have data showing the default doesn't fit.
const MIN_DELAY_BETWEEN_MODALS_MS = 20 * 1000

export interface ModalManagerHandlers {
  onShowModal: (item: QueuedModal) => void
  onActivePath: (path: string) => void
}

/**
 * Queue + SPA-aware path matching for visitor modals. Receives modal
 * deliveries from two sources (realtime push, REST drain on connect),
 * stores them, and emits `onShowModal` whenever the current pathname
 * matches a queued modal's include/exclude rules. Only one modal is
 * surfaced at a time — the host shell decides when to ask for the
 * next via `onShown`/`onDismissed`.
 *
 * Hooks `popstate` + monkey-patches `history.pushState` /
 * `history.replaceState` so SPA navigations re-evaluate the queue
 * without the consumer wiring up its own listener — the widget can't
 * assume anything about the embedder's router (Next, React Router,
 * vanilla, etc.). Restores the originals on `disconnect`.
 */
export class ModalManager {
  private queue: QueuedModal[] = []
  private currentDeliveryId: string | null = null
  private handlers: ModalManagerHandlers
  private originalPushState: typeof history.pushState | null = null
  private originalReplaceState: typeof history.replaceState | null = null
  private popstateHandler: (() => void) | null = null
  private connected = false
  /**
   * Wall-clock timestamp of the last modal that hit the screen. Drives
   * the inter-modal cooldown so a fast dismiss → next-show doesn't
   * stack two modals back to back. Zero means "never shown yet" — the
   * cooldown is bypassed on the very first delivery so a fresh visitor
   * doesn't sit through a phantom 20s wait.
   */
  private lastShownAt = 0
  /**
   * Single timer that re-fires `evaluate()` once the inter-modal
   * cooldown elapses. We keep at most one in flight — every code path
   * that schedules a new one clears the previous, so a burst of nav
   * events during the cooldown doesn't pile up N pending evaluations.
   */
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null

  constructor(handlers: ModalManagerHandlers) {
    this.handlers = handlers
  }

  connect(): void {
    if (this.connected) return
    if (typeof window === 'undefined') return
    this.connected = true

    this.originalPushState = history.pushState
    this.originalReplaceState = history.replaceState

    const reEval = () => this.evaluate()
    this.popstateHandler = reEval

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!.apply(history, args)
      reEval()
    }
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!.apply(history, args)
      reEval()
    }
    window.addEventListener('popstate', reEval)
  }

  disconnect(): void {
    if (!this.connected) return
    if (typeof window === 'undefined') return
    if (this.originalPushState) history.pushState = this.originalPushState
    if (this.originalReplaceState) history.replaceState = this.originalReplaceState
    if (this.popstateHandler) window.removeEventListener('popstate', this.popstateHandler)
    this.clearCooldownTimer()
    this.connected = false
    this.queue = []
    this.currentDeliveryId = null
    this.lastShownAt = 0
  }

  enqueue(payload: VisitorModalShowPayload): void {
    if (this.queue.some((q) => q.deliveryId === payload.deliveryId)) return
    if (this.currentDeliveryId === payload.deliveryId) return
    this.queue.push({
      deliveryId: payload.deliveryId,
      modalId: payload.modalId,
      sourceType: payload.sourceType,
      automationId: payload.automationId,
      campaignId: payload.campaignId,
      modal: payload.modal,
      queuedAt: Date.now(),
    })
    this.evaluate()
  }

  /**
   * Mark the current modal as shown; clear the slot so the next
   * matching one can surface. Schedules a deferred re-evaluation when
   * the inter-modal cooldown elapses, so visitors who stay on the
   * same page still see queued modals later (instead of having to
   * navigate to trigger them). The cooldown gate inside `evaluate()`
   * is the actual back-stop against overlap — this scheduler just
   * ensures the queue gets revisited at the right moment.
   */
  markShown(deliveryId: string): void {
    if (this.currentDeliveryId !== deliveryId) return
    this.currentDeliveryId = null
    this.scheduleCooldownEval()
  }

  /**
   * After dismissal: same lifecycle as `markShown` — the user closed
   * the surface (via the X button, ESC, or backdrop click), the slot
   * frees up, and we re-evaluate after the cooldown so a queued modal
   * for the current path can take the stage next.
   */
  markDismissed(deliveryId: string): void {
    this.markShown(deliveryId)
  }

  private currentPath(): string {
    if (typeof window === 'undefined') return '/'
    return window.location.pathname || '/'
  }

  /**
   * Walk the queue, drop stale entries (TTL), and surface the first
   * one that (a) matches the current path AND (b) clears the
   * inter-modal cooldown. Idempotent — safe to call from N event
   * sources (nav, enqueue, post-dismiss timer). The cooldown gate is
   * the only reason a same-path queued modal might NOT show even when
   * the slot is free.
   */
  private evaluate(): void {
    if (this.currentDeliveryId) return // one at a time.
    if (typeof window === 'undefined') return

    const path = this.currentPath()
    this.handlers.onActivePath(path)

    const now = Date.now()
    this.queue = this.queue.filter((q) => now - q.queuedAt < QUEUE_TTL_MS)

    // Inter-modal cooldown — bail and reschedule if we showed a modal
    // too recently. `lastShownAt === 0` is "never shown" and bypasses
    // the cooldown so the very first delivery doesn't sit through a
    // phantom wait.
    if (this.lastShownAt > 0) {
      const sinceLast = now - this.lastShownAt
      if (sinceLast < MIN_DELAY_BETWEEN_MODALS_MS) {
        this.scheduleCooldownEval(MIN_DELAY_BETWEEN_MODALS_MS - sinceLast)
        return
      }
    }

    const match = this.queue.find((q) =>
      shouldShowOnPath(path, q.modal.includePaths, q.modal.excludePaths)
    )
    if (!match) return

    this.queue = this.queue.filter((q) => q.deliveryId !== match.deliveryId)
    this.currentDeliveryId = match.deliveryId
    this.lastShownAt = Date.now()
    // We just consumed the cooldown window; clear any pending timer
    // since the next eval is gated on a fresh `lastShownAt`.
    this.clearCooldownTimer()
    this.handlers.onShowModal(match)
  }

  /**
   * Single-shot timer that re-fires `evaluate()` after the inter-modal
   * cooldown. Replaces any prior timer so a burst of nav events
   * during the cooldown doesn't accumulate parallel evaluations.
   * `delayMs` defaults to the full cooldown — callers that already
   * know the partial remainder pass it explicitly.
   */
  private scheduleCooldownEval(delayMs: number = MIN_DELAY_BETWEEN_MODALS_MS): void {
    this.clearCooldownTimer()
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null
      this.evaluate()
    }, Math.max(0, delayMs))
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }
  }
}
