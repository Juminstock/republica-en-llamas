import { Field, capsule, ellipsoid, roundBox, roundCone, smax, smin, sphere, type Prim, type V3 } from './sdf'
import type { Joints, Shape, Side } from './skeleton'

const SIDES: Side[] = ['L', 'R']

export type BodyParts = { field: Field; torso: Prim[]; arms: Prim[]; legs: Prim[] }

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Sculpted, clothed-body silhouette in the bind pose (A pose). Hands and head are separate meshes.
export function bodyField(j: Joints, shape: Shape): BodyParts {
  const s = j.scale
  const g = shape.girth
  const fem = shape.feminine
  const sh = shape.shoulders
  const gl = Math.sqrt(g)
  const f = new Field()
  const torso: Prim[] = []
  const arms: Prim[] = []
  const legs: Prim[] = []
  const T = (p: Prim, k: number) => {
    torso.push(p)
    f.add(p, k * s)
  }
  const A = (p: Prim, k: number) => {
    arms.push(p)
    f.add(p, k * s)
  }
  const Lg = (p: Prim, k: number) => {
    legs.push(p)
    f.add(p, k * s)
  }
  const v = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s]

  // Torso
  T(ellipsoid(v(0, 0.95, 0.005), v((fem ? 0.158 : 0.138) * g, 0.1, 0.098 * g), 'hips', 'pelvis'), 0.05)
  for (const sg of [1, -1]) T(ellipsoid(v((fem ? 0.068 : 0.06) * sg, 0.905, -0.045), v(fem ? 0.084 : 0.07, 0.09, 0.072 * g * (fem ? 1.12 : 1)), 'hips', 'pelvis'), 0.05)
  T(ellipsoid(v(0, 1.075, 0.012), v((fem ? 0.112 : 0.138) * g, 0.12, 0.094 * g), 'spine', 'torso'), 0.07)
  if (g > 1.08) T(ellipsoid(v(0, 1.06, 0.045 * g), v(0.115 * g, 0.1, 0.08 * g), 'spine', 'torso'), 0.06)
  T(ellipsoid(v(0, 1.265, 0.0), v((fem ? 0.136 : 0.152) * sh, 0.15, 0.104 * gl), 'chest', 'torso'), 0.06)
  if (fem) for (const sg of [1, -1]) T(ellipsoid(v(0.058 * sg, 1.275, 0.068), v(0.058, 0.052, 0.045), 'chest', 'torso'), 0.04)
  else for (const sg of [1, -1]) T(ellipsoid(v(0.06 * sg, 1.33, 0.05), v(0.068, 0.04, 0.032), 'chest', 'torso'), 0.05)
  T(capsule(v(-0.118 * sh, 1.408, -0.028), v(0.118 * sh, 1.408, -0.028), 0.058 * s, 'chest', 'torso'), 0.05)
  for (const sg of [1, -1]) T(roundCone(v(0.118 * sh * sg, 1.405, -0.026), v(0.035 * sg, 1.47, -0.03), 0.046 * s, 0.04 * s, 'chest', 'torso'), 0.05)
  // Neck
  T(roundCone(v(0, 1.4, -0.015), v(0, 1.555, 0.0), 0.057 * s * (fem ? 0.9 : 1), 0.05 * s * (fem ? 0.88 : 1), 'neck', 'neck'), 0.035)

  // Arms
  for (const side of SIDES) {
    const sg = side === 'L' ? 1 : -1
    const sho = j.shoulder[side]
    const elb = j.elbow[side]
    const wri = j.wrist[side]
    const ga = Math.pow(g, 0.6)
    A(ellipsoid([sho[0] + 0.006 * s * sg, sho[1] - 0.016 * s, sho[2]], v(0.05 * ga * (fem ? 0.9 : 1), 0.055, 0.052 * ga), `upperArm_${side}`, 'arm'), 0.032)
    A(roundCone(sho, elb, 0.047 * s * ga * (fem ? 0.88 : 1), 0.038 * s * ga * (fem ? 0.9 : 1), `upperArm_${side}`, 'arm'), 0.03)
    A(roundCone(elb, lerp3(elb, wri, 0.55), 0.041 * s * ga * (fem ? 0.9 : 1), 0.034 * s * ga * (fem ? 0.9 : 1), `forearm_${side}`, 'forearm'), 0.025)
    A(roundCone(lerp3(elb, wri, 0.5), wri, 0.034 * s * ga * (fem ? 0.9 : 1), 0.026 * s * (fem ? 0.9 : 1), `forearm_${side}`, 'forearm'), 0.02)
  }

  // Legs
  for (const side of SIDES) {
    const hip = j.hip[side]
    const knee = j.knee[side]
    const ank = j.ankle[side]
    const ball = j.ball[side]
    const toe = j.toe[side]
    const lg = Math.pow(g, 0.7)
    Lg(roundCone([hip[0], hip[1] + 0.02 * s, hip[2]], knee, (fem ? 0.088 : 0.08) * s * lg, 0.053 * s * lg, `thigh_${side}`, 'thigh'), 0.045)
    Lg(sphere(knee, 0.05 * s * lg, `shin_${side}`, 'shin'), 0.025)
    Lg(roundCone(knee, ank, 0.049 * s * lg, 0.034 * s, `shin_${side}`, 'shin'), 0.03)
    Lg(ellipsoid(lerp3(knee, ank, 0.28).map((c, i) => (i === 2 ? c - 0.022 * s : c)) as V3, v(0.046 * lg, 0.095, 0.048 * lg), `shin_${side}`, 'shin'), 0.04)
    // Shoe
    const heelZ = ank[2] - 0.055 * s
    const midZ = (heelZ + ball[2]) / 2
    const fw = fem ? 0.038 : 0.043
    Lg(roundBox([ank[0], 0.042 * s, midZ], [fw * s, 0.042 * s, (ball[2] - heelZ) / 2 + 0.012 * s], 0.028 * s, `foot_${side}`, 'foot'), 0.03)
    Lg(roundBox([ball[0], 0.032 * s, (ball[2] + toe[2]) / 2], [fw * 0.96 * s, 0.03 * s, (toe[2] - ball[2]) / 2 + 0.012 * s], 0.027 * s, `toe_${side}`, 'foot'), 0.03)
    Lg(capsule([ank[0], ank[1], ank[2]], [ank[0], ank[1] + 0.07 * s, ank[2] - 0.005 * s], 0.043 * s, `foot_${side}`, 'foot'), 0.025)
  }
  return { field: f, torso, arms, legs }
}

// Hollow lab coat shell: the torso and arms dilated, plus a skirt to the knees, open at the front.
export function labCoatField(j: Joints, shape: Shape) {
  const s = j.scale
  const g = shape.girth
  const parts = bodyField(j, shape)
  const upper = new Field()
  for (const p of [...parts.torso, ...parts.arms]) upper.add(p, 0.05 * s)
  const v = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s]
  const skirt = roundCone(v(0, 1.0, 0.0), v(0, 0.47, -0.01), 0.158 * s * g, 0.205 * s, 'hips', 'skirt')
  const prims = [...parts.torso.filter((p) => p.tag !== 'neck'), ...parts.arms, skirt]
  const cuffs = SIDES.map((side) => sphere(j.wrist[side], 0.036 * s, `forearm_${side}`, 'cut'))
  const ub = upper.bounds(0.03 * s)
  const field = {
    ops: prims.map((prim) => ({ kind: 'add' as const, prim, k: 0 })),
    bounds: () => ({ min: [ub.min[0], 0.44 * s, ub.min[2] - 0.05 * s] as V3, max: [ub.max[0], 1.51 * s, ub.max[2] + 0.03 * s] as V3 }),
    eval(x: number, y: number, z: number) {
      let o = upper.eval(x, y, z) - 0.014 * s
      o = smin(o, skirt.d(x, y, z), 0.05 * s)
      // Thick enough for the mesh grid; the inner wall ends up hidden inside the body.
      let d = smax(o, -(o + 0.024 * s), 0.002 * s)
      // Front opening: a slot down the front that widens into a V at the chest.
      const w = (0.03 + Math.max(0, y / s - 1.12) * 0.32) * s
      const slot = Math.max(Math.abs(x) - w, -(z - 0.02 * s), y - 1.52 * s, 0.4 * s - y)
      d = smax(d, -slot, 0.004 * s)
      for (const c of cuffs) d = smax(d, -c.d(x, y, z), 0.003 * s)
      // Collar line and hem
      d = smax(d, -Math.max(1.45 * s - y, Math.abs(x) - 0.085 * s), 0.006 * s)
      d = smax(d, y - 1.5 * s, 0.006 * s)
      d = smax(d, 0.47 * s - y, 0.004 * s)
      return d
    },
  }
  return field
}
