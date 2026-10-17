import type { CharacterId, Expression, Gesture } from '../characters/types'
import type { Collider, Vec3 } from '../world/layout'

export type NpcSpec = {
  key: string
  id: CharacterId
  at: Vec3
  rotY: number
  gesture?: Gesture
  expression?: Expression
  variant?: number
  // Interaction this NPC answers for; the dialogue camera frames their face.
  interaction?: string
}

const faceToward = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2])

const ASSEMBLY_CENTER: Vec3 = [12, 0, -17.5]
const crowd: NpcSpec[] = Array.from({ length: 9 }, (_, i) => {
  const ring = i < 5 ? 2.6 : 4
  const angle = Math.PI * (0.15 + (i % 5) * 0.18) + (i >= 5 ? 0.25 : 0)
  const at: Vec3 = [ASSEMBLY_CENTER[0] + Math.cos(angle) * ring, 0, ASSEMBLY_CENTER[2] + Math.sin(angle) * ring * 0.6 - 1.2]
  return { key: `crowd-${i}`, id: 'student', at, rotY: faceToward(at, ASSEMBLY_CENTER), gesture: i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'crossArms' : 'none', variant: i % 6 }
})

// Plaza cast: clerks behind the stall counters, the rector at the Palacio door, the assembly.
export const PLAZA_NPCS: NpcSpec[] = [
  { key: 'clerk-biblioteca', id: 'clerk', at: [-34.6, 0, -10], rotY: Math.PI / 2, variant: 0, interaction: 'biblioteca' },
  { key: 'clerk-bienestar', id: 'clerk', at: [-34.6, 0, 14], rotY: Math.PI / 2, variant: 1, interaction: 'bienestar' },
  { key: 'clerk-tesoreria', id: 'clerk', at: [28.6, 0, -16], rotY: -Math.PI / 2, variant: 2, interaction: 'tesoreria' },
  { key: 'rector', id: 'rector', at: [1.4, 0, -31.3], rotY: 0.15, gesture: 'crossArms', interaction: 'rectoria' },
  { key: 'vocera', id: 'student', at: [12, 0, -14.4], rotY: Math.PI * 0.95, gesture: 'talk', variant: 1, interaction: 'asamblea' },
  ...crowd,
]

export const npcCollidersFor = (npcs: NpcSpec[]): Collider[] => npcs.map((n) => ({ kind: 'circle', x: n.at[0], z: n.at[2], r: 0.45 }))

// UdeA cast, placed from the campus landmarks: the library clerk, soldiers at the gate, students.
export function udeaNpcs(lm: { libraryWindow: Vec3; gate: Vec3; crowdArea: Vec3 }, libraryFacing: number): NpcSpec[] {
  const [gx, , gz] = lm.gate
  const [cx, , cz] = lm.crowdArea
  return [
    { key: 'clerk-udea', id: 'clerk', at: lm.libraryWindow, rotY: libraryFacing, variant: 1, interaction: 'biblioteca', gesture: 'typing' },
    { key: 'soldier-1', id: 'soldier', at: [gx - 2.2, 0, gz - 2], rotY: Math.PI, gesture: 'crossArms', expression: 'angry' },
    { key: 'soldier-2', id: 'soldier', at: [gx + 2.2, 0, gz - 2], rotY: Math.PI, gesture: 'none', expression: 'neutral' },
    ...Array.from({ length: 5 }, (_, i): NpcSpec => {
      const at: Vec3 = [cx + Math.cos(i * 1.3) * 3.5, 0, cz + Math.sin(i * 1.3) * 2.5]
      return { key: `udea-student-${i}`, id: 'student', at, rotY: faceToward(at, lm.crowdArea), gesture: i % 2 ? 'talk' : 'crossArms', variant: (i + 2) % 6 }
    }),
  ]
}
