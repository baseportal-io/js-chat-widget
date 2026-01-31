export type EventCallback = (...args: any[]) => void

export class EventEmitter {
  private listeners = new Map<string, Set<EventCallback>>()

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args)
      } catch (e) {
        console.error(`[BaseportalChat] Error in ${event} handler:`, e)
      }
    })
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
