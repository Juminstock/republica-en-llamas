// The only channel between the 3D scene and React overlays.
export type HandIcon = 'open' | 'fist' | 'document' | 'bunuelo'

export type GameEvents = {
  'interact:available': { id: string; label: string; hand: HandIcon } | null
  'interact': { id: string }
}

type Listener<K extends keyof GameEvents> = (payload: GameEvents[K]) => void

class TypedBus {
  private listeners = new Map<keyof GameEvents, Set<Listener<never>>>()

  emitEvent<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<K>)(payload))
  }

  onEvent<K extends keyof GameEvents>(event: K, fn: Listener<K>) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn as Listener<never>)
    return () => {
      this.listeners.get(event)?.delete(fn as Listener<never>)
    }
  }
}

export const EventBus = new TypedBus()
