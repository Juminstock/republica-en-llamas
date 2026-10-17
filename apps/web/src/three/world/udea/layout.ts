import type { Collider, Vec3 } from '../layout'
import type { LocationLayout } from '../locations'
import type { LampSpot } from '../Lamps'
import { propColliders, type Spot } from '../Props'

// UdeA "Ciudad Universitaria", in meters. Origin at the center of the main plazoleta, +x east, +z south.

export const PLAZOLETA = { minX: -34, maxX: 34, minZ: -24, maxZ: 24 }

export const TEATRO = { x: 6, z: -38, width: 48, depth: 26, height: 11 }
export const ADMIN = { minX: 34, maxX: 56, minZ: -28, maxZ: 26, floorY: 5, height: 10 }
export const POOL = { minX: 26, maxX: 32, minZ: -22, maxZ: 20 }
export const LIBRARY = { minX: -60, maxX: -38, minZ: -20, maxZ: 14, height: 11 }
export const MONUMENT = { x: -8, z: -14 }
export const GATE = { x: -6, z: 68, width: 9 }
export const FENCE_Z = 68
export const METRO_Z = 94

// Brick blocks with terracotta hip roofs scattered around the plazoleta.
export const BLOCKS: { x: number; z: number; w: number; d: number; h: number; rotY?: number }[] = [
  { x: -46, z: 40, w: 26, d: 15, h: 8.5 },
  { x: -10, z: 46, w: 24, d: 14, h: 8 },
  { x: 26, z: 46, w: 22, d: 15, h: 9 },
  { x: 52, z: 50, w: 18, d: 14, h: 8 },
  { x: -50, z: -46, w: 22, d: 16, h: 9 },
  { x: 48, z: -50, w: 24, d: 15, h: 8.5 },
  { x: -26, z: -54, w: 18, d: 13, h: 7.5 },
]

export const UDEA_LANDMARKS = {
  podium: [6, 0.9, -20.8] as Vec3,
  crowdArea: [6, 0, -11] as Vec3,
  gate: [GATE.x, 0, GATE.z] as Vec3,
  teatro: [TEATRO.x, 0, TEATRO.z] as Vec3,
  monument: [MONUMENT.x, 0, MONUMENT.z] as Vec3,
  pool: [(POOL.minX + POOL.maxX) / 2, 0, (POOL.minZ + POOL.maxZ) / 2] as Vec3,
  // The clerk stands inside the library's service window, facing east toward the plazoleta.
  libraryWindow: [-38.9, 0, -3] as Vec3,
  metroStairs: [16, 0, 79] as Vec3,
  views: {
    aerial: { pos: [-96, 72, 104] as Vec3, lookAt: [2, 0, -6] as Vec3 },
    monument: { pos: [-2.5, 1.1, -4] as Vec3, lookAt: [-8, 13, -14] as Vec3 },
    podium: { pos: [7.6, 2.5, -14] as Vec3, lookAt: [6, 2.4, -20.8] as Vec3 },
    crowd: { pos: [6.7, 3.3, -23.2] as Vec3, lookAt: [6, 1.4, -6] as Vec3 },
    ruinedWide: { pos: [4, 15, 38] as Vec3, lookAt: [-2, 2, -16] as Vec3 },
    ruinedDetail: { pos: [-29, 1.6, 6] as Vec3, lookAt: [-38.5, 2.2, -3] as Vec3 },
    gate: { pos: [10, 2, 86] as Vec3, lookAt: [-6, 4, 66] as Vec3 },
  },
}

const box = (minX: number, maxX: number, minZ: number, maxZ: number): Collider => ({ kind: 'box', minX, maxX, minZ, maxZ })

export const UDEA_TREES: [number, number][] = [
  [-30, 30], [-22, 34], [-2, 32], [12, 30], [30, 30], [40, 36], [-36, 22], [62, 6], [62, 28], [-64, 22], [-66, -10],
  [-30, -32], [-14, -34], [30, -34], [62, -24], [-40, 56], [8, 58], [36, 60], [-24, 60], [-62, 58], [64, 62],
  [20, -60], [-4, -62], [66, -60], [-66, -58],
]
// Extra canopy on the lawns, kept clear of buildings, paths and the plazoleta.
export const UDEA_LAWN_TREES: [number, number][] = (() => {
  let seed = 4242
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const keepOut: [number, number, number, number][] = [
    [-37, 37, -27, 27], [-12, 0, 24, 70], [-64, -34, -24, 18], [22, 60, -32, 30], [-20, 32, -54, -18],
    ...BLOCKS.map((b) => [b.x - b.w / 2 - 4, b.x + b.w / 2 + 4, b.z - b.d / 2 - 4, b.z + b.d / 2 + 4] as [number, number, number, number]),
  ]
  const out: [number, number][] = []
  for (let i = 0; i < 400 && out.length < 46; i++) {
    const x = -66 + rand() * 132
    const z = -66 + rand() * 128
    if (keepOut.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue
    if (out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 7)) continue
    out.push([x, z])
  }
  return out
})()

export const UDEA_PALMS: [number, number][] = [
  [-20, -27], [-26, -20], [22, -26], [-30, 26], [18, 27], [-12, 27], [24, 6], [-36, 4],
]

const Q = Math.PI / 2

export const UDEA_LAMPS: LampSpot[] = [
  { x: -36, z: -22, rotY: Q }, { x: 36, z: 18, rotY: -Q }, { x: -6, z: 24.5, rotY: Math.PI }, { x: 20, z: -24, rotY: 0 },
  { x: -36, z: 12, rotY: Q }, { x: -10.5, z: 50, rotY: Q }, { x: -1.5, z: 62, rotY: -Q }, { x: 10, z: 72, rotY: Math.PI },
  { x: 24.5, z: -12, rotY: -Q }, { x: -24, z: 24.5, rotY: Math.PI },
]
export const UDEA_BENCHES: Spot[] = [
  { x: -24, z: -22.5, rotY: 0 }, { x: 18, z: 23, rotY: Math.PI }, { x: -30, z: 6, rotY: Q }, { x: 22.5, z: 10, rotY: -Q }, { x: -14, z: 23, rotY: Math.PI },
]
export const UDEA_BINS: Spot[] = [{ x: -22, z: -22.8, rotY: 0 }, { x: 20, z: 23.2, rotY: 0 }, { x: -2, z: 60, rotY: 0 }]

export const UDEA_COLLIDERS: Collider[] = [
  ...propColliders(UDEA_BENCHES, UDEA_BINS, []),
  ...UDEA_LAMPS.map((l) => ({ kind: 'circle' as const, x: l.x, z: l.z, r: 0.2 })),
  // The theatre, its colonnade and front steps (the steps are a stage, not walkable at ground level).
  box(TEATRO.x - TEATRO.width / 2, TEATRO.x + TEATRO.width / 2, TEATRO.z - TEATRO.depth / 2, -21),
  box(GATE.x - 1.6, GATE.x + 1.6, FENCE_Z - 0.8, FENCE_Z + 0.8),
  box(LIBRARY.minX, LIBRARY.maxX, LIBRARY.minZ, LIBRARY.maxZ),
  box(POOL.minX, POOL.maxX, POOL.minZ, POOL.maxZ),
  box(46, ADMIN.maxX, -12, 10),
  ...BLOCKS.map((b) => box(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2)),
  { kind: 'circle', x: MONUMENT.x, z: MONUMENT.z, r: 4.2 },
  ...[...UDEA_TREES, ...UDEA_LAWN_TREES].map(([x, z]) => ({ kind: 'circle' as const, x, z, r: 0.6 })),
  ...UDEA_PALMS.map(([x, z]) => ({ kind: 'circle' as const, x, z, r: 0.45 })),
  // Pilotis under the admin block (two rows of columns)
  ...[-22, -12, -2, 8, 18].flatMap((z) => [36, 42].map((x) => ({ kind: 'circle' as const, x, z, r: 0.5 }))),
  // Fence with the gate opening, and the street outside it
  box(-80, GATE.x - GATE.width / 2, FENCE_Z - 0.4, FENCE_Z + 0.4),
  box(GATE.x + GATE.width / 2, 80, FENCE_Z - 0.4, FENCE_Z + 0.4),
  box(-80, 80, 86, 92),
  box(14.4, 17.6, 78.6, 92),
  box(-80, -30, FENCE_Z, 92),
  box(32, 80, FENCE_Z, 92),
  // Campus edges
  box(-80, -70, -80, 92),
  box(70, 80, -80, 92),
  box(-80, 80, -80, -70),
]

export const UDEA_LAYOUT: LocationLayout = {
  id: 'udea',
  name: 'Ciudad Universitaria (UdeA)',
  // Arriving by Metro: at the foot of the station stairs, facing the gate.
  spawn: [11, 0, 73],
  spawnHeading: Math.PI,
  colliders: UDEA_COLLIDERS,
  interactions: [
    { id: 'biblioteca', label: 'Biblioteca Carlos Gaviria Díaz', at: [-35.4, 0, -3], radius: 3, hand: 'document' },
    { id: 'metro-plaza', label: 'Volver a la Plaza Botero (Metro)', at: [16, 0, 75.5], radius: 3, hand: 'open' },
  ],
}
