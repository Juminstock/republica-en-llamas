import * as THREE from 'three'
import type { V3 } from './sdf'

// Body proportions in meters for a 1.75 m adult, scaled per look.
export type Shape = {
  height: number
  girth: number
  shoulders: number
  feminine: boolean
  hunch: number
}

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
export type Finger = (typeof FINGERS)[number]
export type Side = 'L' | 'R'

// Arms rest at this angle from vertical in the bind pose (A pose).
export const ARM_BIND_ANGLE = (48 * Math.PI) / 180

export type Joints = {
  hips: V3
  spine: V3
  chest: V3
  neck: V3
  head: V3
  headTop: number
  clavicle: Record<Side, V3>
  shoulder: Record<Side, V3>
  elbow: Record<Side, V3>
  wrist: Record<Side, V3>
  hip: Record<Side, V3>
  knee: Record<Side, V3>
  ankle: Record<Side, V3>
  ball: Record<Side, V3>
  toe: Record<Side, V3>
  // Hand frame in bind: finger direction and palm normal (root space).
  handDir: Record<Side, THREE.Vector3>
  palmNormal: Record<Side, THREE.Vector3>
  // Canonical hand space to root space for each side (rotation + translation to the wrist).
  handMatrix: Record<Side, THREE.Matrix4>
  // Finger joints in canonical hand space (wrist at origin, fingers along +x, palm facing -y, thumb +z).
  fingerJoints: Record<Finger, V3[]>
  scale: number
}

const sideSign = (s: Side) => (s === 'L' ? 1 : -1)

export function canonicalFingerJoints(feminine: boolean): Record<Finger, V3[]> {
  const w = feminine ? 0.92 : 1
  // Knuckle positions across the palm and phalanx lengths.
  const finger = (z: number, base: number, lens: [number, number, number], yaw: number): V3[] => {
    const pts: V3[] = [[base * w, 0, z * w]]
    let x = base * w, zz = z * w
    for (const l of lens) {
      x += l * w * Math.cos(yaw)
      zz += l * w * Math.sin(yaw)
      pts.push([x, 0, zz])
    }
    return pts
  }
  return {
    // Thumb: carpometacarpal joint near the wrist, angled toward +z and slightly down.
    thumb: [
      [0.022 * w, -0.012, 0.022 * w],
      [0.05 * w, -0.016, 0.042 * w],
      [0.077 * w, -0.016, 0.056 * w],
      [0.1 * w, -0.016, 0.066 * w],
    ],
    index: finger(0.024, 0.088, [0.042, 0.025, 0.021], 0.05),
    middle: finger(0.006, 0.092, [0.046, 0.028, 0.022], 0),
    ring: finger(-0.012, 0.088, [0.043, 0.027, 0.021], -0.05),
    pinky: finger(-0.027, 0.08, [0.034, 0.02, 0.019], -0.12),
  }
}

export function computeJoints(shape: Shape): Joints {
  const s = shape.height
  const sh = shape.shoulders * (shape.feminine ? 0.93 : 1)
  const hipW = shape.feminine ? 0.098 : 0.09
  const v = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s]
  const per = <T,>(f: (sg: number, side: Side) => T): Record<Side, T> => ({ L: f(1, 'L'), R: f(-1, 'R') })

  const shoulder = per((g) => v(0.178 * sh * g, 1.425, -0.012))
  const armDir = per((g) => new THREE.Vector3(Math.sin(ARM_BIND_ANGLE) * g, -Math.cos(ARM_BIND_ANGLE), 0))
  const upper = 0.285 * s
  const fore = 0.255 * s
  const add = (a: V3, d: THREE.Vector3, l: number): V3 => [a[0] + d.x * l, a[1] + d.y * l, a[2] + d.z * l]
  const elbow = per((_, side) => add(shoulder[side], armDir[side], upper))
  const wrist = per((_, side) => add(elbow[side], armDir[side], fore))
  const handDir = per((_, side) => armDir[side].clone())
  // Palm faces down and toward the body in the A pose.
  const palmNormal = per((g) => new THREE.Vector3(-Math.cos(ARM_BIND_ANGLE) * g, -Math.sin(ARM_BIND_ANGLE), 0))

  const handMatrix = per((g, side) => {
    const xAxis = handDir[side].clone()
    const yAxis = palmNormal[side].clone().negate()
    // Left hand: thumb forward (+z). The right hand is mirrored in canonical z.
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).multiplyScalar(g)
    const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    m.scale(new THREE.Vector3(s, s, s))
    m.setPosition(wrist[side][0], wrist[side][1], wrist[side][2])
    return m
  })

  const hip = per((g) => v(hipW * g, 0.915, 0.0))
  const knee = per((g) => v((hipW + 0.006) * g, 0.5, 0.012))
  const ankle = per((g) => v((hipW + 0.012) * g, 0.082, -0.012))
  const ball = per((g) => v((hipW + 0.02) * g, 0.022, 0.12))
  const toe = per((g) => v((hipW + 0.022) * g, 0.02, 0.19))

  return {
    hips: v(0, 0.96, 0),
    spine: v(0, 1.08, -0.01),
    chest: v(0, 1.25, -0.005),
    neck: v(0, 1.46, -0.018),
    head: v(0, 1.555, -0.005),
    headTop: 1.75 * s,
    clavicle: per((g) => v(0.03 * g, 1.43, 0.005)),
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    ball,
    toe,
    handDir,
    palmNormal,
    handMatrix,
    fingerJoints: canonicalFingerJoints(shape.feminine),
    scale: s,
  }
}

export type BoneMap = Record<string, THREE.Bone>

// Builds the bone hierarchy with identity bind rotations; bone positions are offsets from the parent.
export function buildSkeleton(j: Joints): { root: THREE.Bone; bones: BoneMap; list: THREE.Bone[]; bindPos: Record<string, THREE.Vector3> } {
  const bones: BoneMap = {}
  const bindPos: Record<string, THREE.Vector3> = {}
  const list: THREE.Bone[] = []
  const make = (name: string, at: V3 | THREE.Vector3, parent?: string) => {
    const b = new THREE.Bone()
    b.name = name
    const p = at instanceof THREE.Vector3 ? at.clone() : new THREE.Vector3(at[0], at[1], at[2])
    bindPos[name] = p
    if (parent) {
      b.position.copy(p).sub(bindPos[parent])
      bones[parent].add(b)
    } else b.position.copy(p)
    bones[name] = b
    list.push(b)
    return b
  }
  const root = make('hips', j.hips)
  make('spine', j.spine, 'hips')
  make('chest', j.chest, 'spine')
  make('neck', j.neck, 'chest')
  make('head', j.head, 'neck')
  for (const side of ['L', 'R'] as Side[]) {
    make(`clavicle_${side}`, j.clavicle[side], 'chest')
    make(`upperArm_${side}`, j.shoulder[side], `clavicle_${side}`)
    make(`forearm_${side}`, j.elbow[side], `upperArm_${side}`)
    make(`hand_${side}`, j.wrist[side], `forearm_${side}`)
    const hm = j.handMatrix[side]
    for (const f of FINGERS) {
      const pts = j.fingerJoints[f]
      let parent = `hand_${side}`
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Vector3(pts[i][0], pts[i][1], side === 'L' ? pts[i][2] : pts[i][2]).applyMatrix4(hm)
        const name = `${f}${i + 1}_${side}`
        make(name, p, parent)
        parent = name
      }
      bindPos[`${f}Tip_${side}`] = new THREE.Vector3(...pts[3]).applyMatrix4(hm)
    }
    make(`thigh_${side}`, j.hip[side], 'hips')
    make(`shin_${side}`, j.knee[side], `thigh_${side}`)
    make(`foot_${side}`, j.ankle[side], `shin_${side}`)
    make(`toe_${side}`, j.ball[side], `foot_${side}`)
  }
  return { root, bones, list, bindPos }
}

export { sideSign }
