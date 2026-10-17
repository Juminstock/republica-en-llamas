import { CAMP_COLLIDERS } from './Camp'
import { RUIN_COLLIDERS } from './Ruins'
import { VEGETATION_COLLIDERS } from './Vegetation'
import type { Collider } from './layout'

export { PlazaBotero } from './PlazaBotero'
export { WorldLighting, MOODS, type Mood } from './Lighting'
export { CAMPFIRE_SEATS } from './Camp'
export { PLAZA_LAYOUT, PLAZA_TRAVEL } from './plaza/layout'
export { preloadWorldAssets } from './pbr'
export { UdeACampus } from './udea/UdeACampus'
export { UDEA_LAYOUT, UDEA_LANDMARKS } from './udea/layout'
export type { LocationId, LocationLayout, InteractionPoint } from './locations'

// Solid props placed by the world on top of layout.COLLIDERS (tree trunks, tents, vehicles).
export const WORLD_PROP_COLLIDERS: Collider[] = [...VEGETATION_COLLIDERS, ...CAMP_COLLIDERS, ...RUIN_COLLIDERS]
