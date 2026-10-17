import { COLLIDERS, INTERACTION_POINTS, LANDMARKS } from '../layout'
import type { InteractionPoint, LocationLayout } from '../locations'
import { CAMP_COLLIDERS } from '../Camp'
import { RUIN_COLLIDERS } from '../Ruins'
import { VEGETATION_COLLIDERS } from '../Vegetation'
import { propColliders } from '../Props'
import { PLAZA_BENCHES, PLAZA_BINS, PLAZA_KIOSKS, PLAZA_LAMPS, STAIRS_FOOT } from './dressing'

// Stairs up to Parque Berrío station: the way to the UdeA campus.
export const PLAZA_TRAVEL: InteractionPoint = { id: 'metro-udea', label: 'Ir a la UdeA (Metro)', at: [STAIRS_FOOT[0] - 3.4, 0, STAIRS_FOOT[1]], radius: 3, hand: 'open' }

export const PLAZA_LAYOUT: LocationLayout = {
  id: 'plaza',
  name: 'Plaza Botero',
  spawn: LANDMARKS.spawn,
  spawnHeading: Math.PI,
  colliders: [
    ...COLLIDERS,
    ...VEGETATION_COLLIDERS,
    ...CAMP_COLLIDERS,
    ...RUIN_COLLIDERS,
    ...propColliders(PLAZA_BENCHES, PLAZA_BINS, PLAZA_KIOSKS),
    ...PLAZA_LAMPS.map((l) => ({ kind: 'circle' as const, x: l.x, z: l.z, r: 0.2 })),
  ],
  interactions: [...INTERACTION_POINTS, PLAZA_TRAVEL],
}
