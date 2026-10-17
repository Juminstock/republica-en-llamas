import type { Collider, Vec3 } from './layout'

// The game world is split into locations. Each one has its own layout module with this shape.
export type LocationId = 'plaza' | 'udea'

export type InteractionPoint = {
  id: string
  label: string
  at: Vec3
  radius: number
  hand: 'open' | 'fist' | 'document' | 'bunuelo'
}

export type LocationLayout = {
  id: LocationId
  name: string
  spawn: Vec3
  spawnHeading: number
  colliders: Collider[]
  interactions: InteractionPoint[]
}
