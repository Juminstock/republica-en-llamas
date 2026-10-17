import Phaser from 'phaser'

// The only channel between Phaser and React. Phaser never imports React state.
export type GameEvents = {
  'scene:ready': { scene: string }
  'interact:available': { id: string; label: string; hand: HandIcon } | null
  'interact': { id: string }
}

export type HandIcon = 'open' | 'fist' | 'document' | 'bunuelo'

class TypedBus extends Phaser.Events.EventEmitter {
  emitEvent<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
    return this.emit(event, payload)
  }
  onEvent<K extends keyof GameEvents>(event: K, fn: (payload: GameEvents[K]) => void) {
    this.on(event, fn)
    return () => {
      this.off(event, fn)
    }
  }
}

export const EventBus = new TypedBus()
