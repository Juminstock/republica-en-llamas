// Plaza Botero, Medellín, in meters. +x east, +z south, y up. Plaza center at the origin.
// Single source of truth for world placement, collisions, cinematics and interactions.

export type Vec3 = [number, number, number]

export type Collider =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number }

export const PLAZA = { minX: -42, maxX: 42, minZ: -30, maxZ: 32 }

// Palacio de la Cultura: gothic, black and white striped facade, central dome. North side.
export const PALACIO = { x: 0, z: -42, width: 44, depth: 20, height: 22, domeTop: 38 }
// Museo de Antioquia: brick art deco block. West side, facade facing east.
export const MUSEO = { x: -55, z: 2, width: 24, depth: 56, height: 18 }

export const LANDMARKS = {
  spawn: [3, 0, 20] as Vec3,
  campfire: [8, 0, 12] as Vec3,
  palacioDoor: [0, 0, -31.2] as Vec3,
  balcony: [0, 9.5, -31.6] as Vec3,
  plazaCenter: [0, 0, 0] as Vec3,
  stallBiblioteca: [-34, 0, -10] as Vec3,
  stallBienestar: [-34, 0, 14] as Vec3,
  stallTesoreria: [28, 0, -16] as Vec3,
  assembly: [12, 0, -16] as Vec3,
}

// Where the satirical "university in exile" interactables live during Task 1.
export const INTERACTION_POINTS: { id: string; label: string; at: Vec3; radius: number; hand: 'open' | 'fist' | 'document' | 'bunuelo' }[] = [
  { id: 'biblioteca', label: 'Ventanilla de Biblioteca', at: [-31.5, 0, -10], radius: 3, hand: 'document' },
  { id: 'bienestar', label: 'Ventanilla de Bienestar', at: [-31.5, 0, 14], radius: 3, hand: 'document' },
  { id: 'tesoreria', label: 'Ventanilla de Tesorería', at: [25.5, 0, -16], radius: 3, hand: 'document' },
  { id: 'asamblea', label: 'Asamblea del paro', at: [12, 0, -12.5], radius: 4.5, hand: 'open' },
  { id: 'rectoria', label: 'Puerta del Palacio (Rectoría)', at: [0, 0, -29.5], radius: 3.5, hand: 'fist' },
]

// Rotund bronze sculptures, inspired by the plaza's style (generic shapes, not replicas).
export const SCULPTURES: { kind: 'horse' | 'figure' | 'reclining' | 'bird' | 'head'; at: Vec3; rotY: number; scale: number }[] = [
  { kind: 'horse', at: [-14, 0, 6], rotY: 0.6, scale: 1 },
  { kind: 'figure', at: [18, 0, 4], rotY: -0.4, scale: 1 },
  { kind: 'reclining', at: [-6, 0, 24], rotY: 0.2, scale: 1 },
  { kind: 'bird', at: [24, 0, 22], rotY: -1.2, scale: 1 },
  { kind: 'head', at: [-24, 0, -20], rotY: 0.9, scale: 1 },
  { kind: 'figure', at: [-20, 0, 24], rotY: 2.4, scale: 0.9 },
]

export const PEDESTAL_SIZE = 3.2

export const COLLIDERS: Collider[] = [
  // Buildings
  { kind: 'box', minX: PALACIO.x - PALACIO.width / 2, maxX: PALACIO.x + PALACIO.width / 2, minZ: PALACIO.z - PALACIO.depth / 2, maxZ: PALACIO.z + PALACIO.depth / 2 },
  { kind: 'box', minX: MUSEO.x - MUSEO.width / 2, maxX: MUSEO.x + MUSEO.width / 2, minZ: MUSEO.z - MUSEO.depth / 2, maxZ: MUSEO.z + MUSEO.depth / 2 },
  // Play area bounds (invisible walls just outside the plaza)
  { kind: 'box', minX: -60, maxX: 60, minZ: 34, maxZ: 40 },
  { kind: 'box', minX: 44, maxX: 50, minZ: -60, maxZ: 60 },
  { kind: 'box', minX: -60, maxX: 60, minZ: -60, maxZ: -52 },
  { kind: 'box', minX: -60, maxX: -43, minZ: -60, maxZ: -28 },
  { kind: 'box', minX: -60, maxX: -43, minZ: 30, maxZ: 60 },
  // Sculpture pedestals
  ...SCULPTURES.map((s) => ({ kind: 'circle' as const, x: s.at[0], z: s.at[2], r: (PEDESTAL_SIZE / 2) * 1.25 * s.scale })),
  // Campfire and stall counters
  { kind: 'circle', x: 8, z: 12, r: 1.55 },
  { kind: 'box', minX: -36, maxX: -32.6, minZ: -12, maxZ: -8 },
  { kind: 'box', minX: -36, maxX: -32.6, minZ: 12, maxZ: 16 },
  { kind: 'box', minX: 26.6, maxX: 30, minZ: -18, maxZ: -14 },
]
