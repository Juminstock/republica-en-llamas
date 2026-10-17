import * as THREE from 'three'
import type { Rig } from './rig'
import { FINGERS, type Side } from './skeleton'
import { MORPHS } from './head'
import type { Expression, Gesture, HumanoidHandle } from './types'

const V = () => new THREE.Vector3()
const Q = () => new THREE.Quaternion()
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const SIDES: Side[] = ['L', 'R']

// Finger curls [thumb, index, middle, ring, pinky], thumb opposition and spread.
type Fingers = { c: number[]; opp: number; spread: number }
const POSE: Record<string, Fingers> = {
  relaxed: { c: [0.28, 0.24, 0.32, 0.4, 0.46], opp: 0.3, spread: 0.12 },
  fist: { c: [0.8, 1, 1, 1, 1], opp: 1, spread: 0 },
  open: { c: [0.05, 0.03, 0.03, 0.05, 0.07], opp: 0.15, spread: 0.55 },
  point: { c: [0.75, 0, 1, 1, 1], opp: 0.85, spread: 0 },
  grip: { c: [0.55, 0.78, 0.84, 0.88, 0.92], opp: 0.95, spread: 0.02 },
  flat: { c: [0.12, 0.02, 0.02, 0.03, 0.05], opp: 0.25, spread: 0 },
  typing: { c: [0.3, 0.42, 0.48, 0.5, 0.52], opp: 0.4, spread: 0.22 },
  cup: { c: [0.3, 0.32, 0.36, 0.4, 0.44], opp: 0.45, spread: 0.3 },
}

// Pose of one arm in chest space (meters at scale 1); R values are given explicitly.
type ArmPose = { hand: THREE.Vector3; fdir: THREE.Vector3; palm: THREE.Vector3; pole: THREE.Vector3; fingers: Fingers; clav: number }
type Frame = {
  arm: Record<Side, ArmPose>
  armW: Record<Side, number>
  space: 'chest' | 'root'
  spine: THREE.Vector3 // pitch, yaw, roll
  head: THREE.Vector3
  hipsDrop: number
  hipsZ: number
  feetZ: number
}

const arm = (h: [number, number, number], f: [number, number, number], p: [number, number, number], pole: [number, number, number], fingers: Fingers, clav = 0): ArmPose => ({
  hand: new THREE.Vector3(...h),
  fdir: new THREE.Vector3(...f).normalize(),
  palm: new THREE.Vector3(...p).normalize(),
  pole: new THREE.Vector3(...pole).normalize(),
  fingers,
  clav,
})
const emptyFrame = (): Frame => ({
  arm: { L: arm([0.215, -0.33, 0.04], [0.05, -1, 0.12], [-1, 0, 0.1], [0.3, -0.3, -1], POSE.relaxed), R: arm([-0.215, -0.33, 0.04], [-0.05, -1, 0.12], [1, 0, 0.1], [-0.3, -0.3, -1], POSE.relaxed) },
  armW: { L: 0, R: 0 },
  space: 'chest',
  spine: V(),
  head: V(),
  hipsDrop: 0,
  hipsZ: 0,
  feetZ: 0,
})

const EXPRESSIONS: Record<Expression, Partial<Record<FaceKey, number>>> = {
  neutral: {},
  smile: { smileL: 0.85, smileR: 0.85, cheekRaise: 0.65, browUp: 0.15, squint: 0.25 },
  smug: { smileL: 0.75, smileR: 0.12, cheekRaise: 0.3, browUpL: 0.45, furrow: 0.15, squint: 0.3 },
  angry: { frown: 0.55, mouthPress: 0.45, furrow: 1, squint: 0.35 },
  sad: { frown: 0.75, inner: 0.95, droop: 0.35 },
  surprised: { jawOpen: 0.35, mouthRound: 0.3, browUp: 1, wide: 0.7 },
  worried: { inner: 0.75, frown: 0.3, mouthPress: 0.25, wide: 0.15 },
  determined: { furrow: 0.5, mouthPress: 0.35, smileL: 0.12, smileR: 0.12, squint: 0.25 },
}
type FaceKey = (typeof MORPHS)[number] | 'browUp' | 'browUpL' | 'inner' | 'furrow' | 'squint' | 'wide' | 'droop'
const FACE_KEYS: FaceKey[] = [...MORPHS, 'browUp', 'browUpL', 'inner', 'furrow', 'squint', 'wide', 'droop']

const mBasis = new THREE.Matrix4()
function basisQuat(x: THREE.Vector3, yHint: THREE.Vector3, out: THREE.Quaternion, ty = V(), tz = V()) {
  ty.copy(yHint).addScaledVector(x, -x.dot(yHint))
  if (ty.lengthSq() < 1e-8) ty.set(x.y, -x.x, 0.3)
  ty.normalize()
  tz.crossVectors(x, ty)
  mBasis.makeBasis(x, ty, tz)
  return out.setFromRotationMatrix(mBasis)
}

export class Animator {
  readonly handle: HumanoidHandle
  private rig: Rig
  private s: number
  private t = 0
  private seed: number
  // Intent
  private targetSpeed = 0
  private speed = 0
  private crouchT = 0
  private crouch = 0
  private gesture: Gesture = 'none'
  private returnGesture: Gesture = 'none'
  private reachT = -1
  private gw = new Map<Gesture, number>()
  private talking = false
  private expression: Expression = 'neutral'
  private face = new Map<FaceKey, number>()
  private lookTarget = V()
  private hasLook = false
  // Locomotion state
  private phase = 0
  private prevYaw: number | null = null
  private turnRate = 0
  private accel = 0
  private prevSpeed = 0
  private shift = 0
  private shiftT = 0
  private fidgetT = 3
  private fidget = 0
  // Face state
  private blinkT = 2
  private blink = 0
  private blinkQueue = 0
  private saccade = new THREE.Vector2()
  private saccadeT = 1
  private glance = new THREE.Vector2()
  private glanceT = 5
  private eyeYaw = 0
  private eyePitch = 0
  private headYaw = 0
  private headPitch = 0
  private syll = 0
  private syllT = 0
  private viseme = [0, 0, 0, 0]
  private visemeT = [0, 0, 0, 0]
  private pauseT = 0
  private emphasis = 0
  private nod = 0
  // Ponytail spring
  private tailA = new THREE.Vector2()
  private tailV = new THREE.Vector2()
  private prevHead = V()
  private headVel = V()

  // Bind data
  private bind: {
    upper: Record<Side, number>
    fore: Record<Side, number>
    thigh: Record<Side, number>
    shin: Record<Side, number>
    armD: Record<Side, THREE.Vector3>
    legD: Record<Side, { thigh: THREE.Vector3; shin: THREE.Vector3 }>
    handBasisInv: Record<Side, THREE.Quaternion>
    upperBasisInv: Record<Side, THREE.Quaternion>
    foreBasisInv: Record<Side, THREE.Quaternion>
    thighBasisInv: Record<Side, THREE.Quaternion>
    shinBasisInv: Record<Side, THREE.Quaternion>
    curlAxis: Record<Side, THREE.Vector3[][]>
    spreadAxis: Record<Side, THREE.Vector3>
    oppAxis: Record<Side, THREE.Vector3>
    sideSign: Record<Side, number>
    footRest: Record<Side, THREE.Vector3>
    ankleH: number
    hipsY: number
    chestLocal: THREE.Vector3
  }

  // Scratch
  private rq = new Map<string, THREE.Quaternion>()
  private rp = new Map<string, THREE.Vector3>()
  private tmpQ = Q()
  private tmpQ2 = Q()
  private tmpE = new THREE.Euler()
  private v1 = V()
  private v2 = V()
  private v3 = V()
  private frameAcc = emptyFrame()
  private frameTmp = emptyFrame()
  private loco = emptyFrame()
  private rootInv = new THREE.Matrix4()

  constructor(rig: Rig, seed: number) {
    this.rig = rig
    this.s = rig.joints.scale
    this.seed = seed
    this.t = (seed * 1.37) % 10
    this.blinkT = 1 + (seed % 3)
    for (const name of [...rig.skeleton.bones.map((b) => b.name)]) {
      this.rq.set(name, Q())
      this.rp.set(name, V())
    }
    const bp = rig.bindPos
    const per = <T,>(f: (side: Side) => T): Record<Side, T> => ({ L: f('L'), R: f('R') })
    const dir = (a: string, b: string) => bp[b].clone().sub(bp[a]).normalize()
    const inv = (x: THREE.Vector3, y: THREE.Vector3) => basisQuat(x, y, Q()).invert()
    const j = rig.joints
    this.bind = {
      upper: per((sd) => bp[`forearm_${sd}`].distanceTo(bp[`upperArm_${sd}`])),
      fore: per((sd) => bp[`hand_${sd}`].distanceTo(bp[`forearm_${sd}`])),
      thigh: per((sd) => bp[`shin_${sd}`].distanceTo(bp[`thigh_${sd}`])),
      shin: per((sd) => bp[`foot_${sd}`].distanceTo(bp[`shin_${sd}`])),
      armD: per((sd) => dir(`upperArm_${sd}`, `forearm_${sd}`)),
      legD: per((sd) => ({ thigh: dir(`thigh_${sd}`, `shin_${sd}`), shin: dir(`shin_${sd}`, `foot_${sd}`) })),
      handBasisInv: per((sd) => inv(j.handDir[sd], j.palmNormal[sd].clone().negate())),
      upperBasisInv: per((sd) => inv(dir(`upperArm_${sd}`, `forearm_${sd}`), V().set(0, 0, -1))),
      foreBasisInv: per((sd) => inv(dir(`forearm_${sd}`, `hand_${sd}`), V().set(0, 0, -1))),
      thighBasisInv: per((sd) => inv(dir(`thigh_${sd}`, `shin_${sd}`), V().set(0, 0, 1))),
      shinBasisInv: per((sd) => inv(dir(`shin_${sd}`, `foot_${sd}`), V().set(0, 0, 1))),
      curlAxis: per((sd) =>
        FINGERS.map((f) =>
          [1, 2, 3].map((i) => {
            const a = bp[`${f}${i}_${sd}`]
            const b = i < 3 ? bp[`${f}${i + 1}_${sd}`] : bp[`${f}Tip_${sd}`]
            const d = b.clone().sub(a).normalize()
            const n = j.palmNormal[sd].clone()
            if (f === 'thumb') {
              const thumbSide = V().crossVectors(j.handDir[sd], j.palmNormal[sd].clone().negate()).multiplyScalar(sd === 'L' ? 1 : -1)
              n.multiplyScalar(0.6).addScaledVector(thumbSide, -0.8).normalize()
            }
            return V().crossVectors(d, n).normalize()
          }),
        ),
      ),
      spreadAxis: per((sd) => j.palmNormal[sd].clone()),
      oppAxis: per((sd) => j.handDir[sd].clone()),
      sideSign: { L: 1, R: -1 },
      footRest: per((sd) => new THREE.Vector3(j.ankle[sd][0] * 1.06, j.ankle[sd][1], 0)),
      ankleH: j.ankle.L[1],
      hipsY: bp.hips.y,
      chestLocal: bp.chest.clone(),
    }

    this.handle = {
      root: rig.root,
      setSpeed: (v) => {
        this.targetSpeed = Math.max(0, v)
      },
      setCrouch: (c) => {
        this.crouchT = c ? 1 : 0
      },
      setGesture: (g) => {
        if (g === 'reach') {
          if (this.gesture === 'reach' || this.reachT >= 0) return
          this.returnGesture = this.gesture
          this.reachT = 0
          this.gesture = 'reach'
          return
        }
        if (this.reachT >= 0) {
          this.returnGesture = g
          return
        }
        this.gesture = g
      },
      setTalking: (on) => {
        this.talking = on
      },
      setExpression: (e) => {
        this.expression = e
      },
      lookAt: (target) => {
        if (target) {
          this.lookTarget.copy(target)
          this.hasLook = true
        } else this.hasLook = false
      },
    }
  }

  update(dt: number) {
    if (dt <= 0) return
    this.t += dt
    const r = this.rig
    const s = this.s
    const root = r.root
    root.updateMatrixWorld()
    this.rootInv.copy(root.matrixWorld).invert()

    // Intent smoothing
    if (this.reachT >= 0) {
      this.reachT += dt
      if (this.reachT > 0.75) {
        this.reachT = -1
        this.gesture = this.returnGesture
      }
    }
    for (const g of new Set<Gesture>([...this.gw.keys(), this.gesture])) {
      const target = g === this.gesture ? 1 : 0
      const w = (this.gw.get(g) ?? 0) + (target - (this.gw.get(g) ?? 0)) * damp(g === 'reach' ? 9 : 5, dt)
      if (w < 0.001 && target === 0) this.gw.delete(g)
      else this.gw.set(g, w)
    }
    const sitW = this.gw.get('sit') ?? 0
    this.speed += (this.targetSpeed - this.speed) * damp(this.targetSpeed > this.speed ? 5 : 7, dt)
    const v = this.speed * (1 - sitW)
    this.accel += ((v - this.prevSpeed) / dt - this.accel) * damp(4, dt)
    this.prevSpeed = v
    const yaw = root.rotation.y
    if (this.prevYaw !== null) {
      const dy = Math.atan2(Math.sin(yaw - this.prevYaw), Math.cos(yaw - this.prevYaw))
      this.turnRate += (clamp(dy / dt, -4, 4) - this.turnRate) * damp(6, dt)
    }
    this.prevYaw = yaw
    this.crouch += (this.crouchT - this.crouch) * damp(5, dt)
    const crouch = this.crouch * (1 - sitW)
    const moveW = ss(0.05, 0.7, v)
    const runW = ss(2.2, 3.8, v)
    const look = r.look
    const posture = look.posture ?? 0

    // Gait
    const freq = v < 0.01 ? 0 : (0.78 + 0.16 * v) * (1 - runW) + (1.32 + 0.06 * v) * runW
    const duty = 0.62 * (1 - runW) + 0.38 * runW
    this.phase = (this.phase + freq * dt) % 1
    const stride = freq > 0 ? (v * duty) / freq : 0
    const ph = this.phase

    // Idle weight shift and fidgets
    this.shiftT -= dt
    if (this.shiftT < 0) {
      this.shiftT = 3 + ((this.seed * 7 + this.t * 13) % 4)
      this.shift = this.shift > 0 ? -1 : 1
    }
    this.fidgetT -= dt
    if (this.fidgetT < 0) {
      this.fidgetT = 5 + ((this.seed * 3 + this.t * 7) % 6)
      this.fidget = 1
    }
    this.fidget = Math.max(0, this.fidget - dt * 0.6)
    const idle = (1 - moveW) * (1 - sitW)
    const shiftAmt = Math.sin(clamp(this.shift, -1, 1) * Math.PI * 0.5) * idle
    const breathe = Math.sin(this.t * 1.6 + this.seed)

    // Hips
    const hips = r.bones.hips
    const walkBob = -0.017 * Math.cos(ph * 4 * Math.PI) * (1 - runW)
    const runBob = (0.03 * Math.abs(Math.sin(ph * 2 * Math.PI)) - 0.035) * runW
    const frameG = this.blendGestures(dt)
    hips.position.set(
      (0.016 * Math.sin(ph * 2 * Math.PI) * moveW * (1 - runW) + 0.018 * shiftAmt) * s,
      this.bind.hipsY - 0.012 * s + (walkBob + runBob) * moveW * s - crouch * 0.26 * s - frameG.hipsDrop * s + breathe * 0.001 * s,
      (frameG.hipsZ - crouch * 0.05) * s,
    )
    const lean = 0.035 * moveW + 0.17 * runW + clamp(this.accel * 0.03, -0.12, 0.12) + crouch * 0.42 + sitW * 0.1
    const pelvisYaw = -(0.11 * (1 - runW) + 0.2 * runW) * Math.cos(ph * 2 * Math.PI) * moveW
    const pelvisRoll = 0.05 * Math.sin(ph * 2 * Math.PI) * moveW * (1 - runW) - this.turnRate * v * 0.035 + shiftAmt * 0.03
    this.tmpE.set(lean * 0.4 + frameG.spine.x * 0.3, pelvisYaw, pelvisRoll, 'YXZ')
    hips.quaternion.setFromEuler(this.tmpE)

    // Spine, chest, neck (look-at shares the yaw)
    const lookYP = this.computeLook(dt)
    const sp = r.bones.spine, ch = r.bones.chest
    this.tmpE.set(lean * 0.35 + frameG.spine.x * 0.35 + look.hunch * 0.3 - posture * 0.015, -pelvisYaw * 0.6 + frameG.spine.y * 0.5 + lookYP.x * 0.12, -pelvisRoll * 0.6 + frameG.spine.z * 0.5, 'YXZ')
    sp.quaternion.setFromEuler(this.tmpE)
    this.tmpE.set(
      lean * 0.25 + frameG.spine.x * 0.35 + look.hunch * 0.7 - posture * 0.03 + breathe * 0.012,
      -pelvisYaw * 0.65 + frameG.spine.y * 0.5 + lookYP.x * 0.12 + Math.sin(this.t * 0.31 + this.seed) * 0.02 * idle,
      -pelvisRoll * 0.4 + frameG.spine.z * 0.5,
      'YXZ',
    )
    ch.quaternion.setFromEuler(this.tmpE)
    const talkNod = this.nod
    const nk = r.bones.neck, hd = r.bones.head
    const stab = -lean * 0.55
    this.tmpE.set(stab * 0.5 + (-lookYP.y * 0.35) + frameG.head.x * 0.4 - look.hunch * 0.4 + posture * 0.03 - frameG.spine.x * 0.3, lookYP.x * 0.33, frameG.head.z * 0.4 - pelvisRoll * 0.3, 'YXZ')
    nk.quaternion.setFromEuler(this.tmpE)
    this.tmpE.set(
      stab * 0.5 - lookYP.y * 0.55 + frameG.head.x * 0.6 + talkNod + Math.sin(this.t * 0.7 + this.seed) * 0.015 - look.hunch * 0.2 + posture * 0.01 - frameG.spine.x * 0.25,
      lookYP.x * 0.43 + frameG.head.y + Math.sin(this.t * 0.43 + this.seed * 2) * 0.02 * idle,
      frameG.head.z * 0.6 - pelvisRoll * 0.3,
      'YXZ',
    )
    hd.quaternion.setFromEuler(this.tmpE)
    this.fk('hips', null)
    for (const n of ['spine', 'chest', 'neck', 'head']) this.fk(n, n === 'spine' ? 'hips' : n === 'chest' ? 'spine' : n === 'neck' ? 'chest' : 'neck')

    // Legs
    for (const side of SIDES) {
      const sg = side === 'L' ? 1 : -1
      const fp = (ph + (side === 'L' ? 0 : 0.5)) % 1
      const target = this.v1
      let pitch = 0
      let toe = 0
      const rest = this.bind.footRest[side]
      // Standing: one foot a touch forward depending on weight shift.
      target.set(rest.x + crouch * 0.05 * sg * s, this.bind.ankleH, (0.02 * sg * shiftAmt + crouch * 0.08 * sg) * s)
      if (moveW > 0) {
        let z: number, lift: number
        if (fp < duty) {
          const k = fp / duty
          z = stride * (0.5 - k)
          lift = 0
          pitch = -0.22 * (1 - ss(0, 0.16, k)) * (1 - runW) + 0.55 * ss(0.68, 1, k)
          toe = -pitch * ss(0.68, 1, k)
        } else {
          const k = (fp - duty) / (1 - duty)
          z = stride * (-0.5 + ss(0, 1, k))
          lift = Math.sin(Math.PI * Math.pow(k, 0.85)) * (0.07 + 0.13 * runW) * s
          pitch = 0.55 * (1 - ss(0, 0.3, k)) - 0.15 * ss(0.6, 1, k)
          toe = -pitch * (1 - ss(0, 0.3, k))
        }
        const heelRaise = pitch > 0 ? Math.sin(pitch) * 0.12 * s : -Math.sin(pitch) * 0.04 * s
        const mz = z * 0.92
        target.x += (moveW * (-0.012 * sg)) * s
        target.y = THREE.MathUtils.lerp(target.y, this.bind.ankleH + lift + heelRaise, moveW)
        target.z = THREE.MathUtils.lerp(target.z, mz, moveW)
        pitch *= moveW
        toe *= moveW
      }
      // Sitting: feet planted forward of the seat.
      if (sitW > 0) {
        target.lerp(this.v2.set((0.13 + frameG.feetZ * 0) * sg * s, this.bind.ankleH, (0.4 + frameG.feetZ) * s), sitW)
        pitch *= 1 - sitW
      }
      if (crouch > 0.01) pitch = THREE.MathUtils.lerp(pitch, -0.1, crouch)
      this.solveLeg(side, target, pitch, toe, pelvisYaw * 0.5)
    }

    // Arms: locomotion swing under gestures
    this.locomotionArms(ph, moveW, runW, crouch, sitW)
    const chestQ = this.rq.get('chest')!
    const chestP = this.rp.get('chest')!
    for (const side of SIDES) {
      const w = frameG.armW[side]
      const L = this.loco.arm[side]
      const G = frameG.arm[side]
      const hand = this.aHand.copy(L.hand).lerp(G.hand, w).multiplyScalar(s)
      const fdir = this.aF.copy(L.fdir).lerp(G.fdir, w).normalize()
      const palm = this.aP.copy(L.palm).lerp(G.palm, w).normalize()
      const pole = this.aPole.copy(L.pole).lerp(G.pole, w).normalize()
      const clav = THREE.MathUtils.lerp(L.clav, G.clav, w)
      this.solveArm(side, hand.applyQuaternion(chestQ).add(chestP), fdir.applyQuaternion(chestQ), palm.applyQuaternion(chestQ), pole.applyQuaternion(chestQ), clav)
      this.poseFingers(side, L.fingers, G.fingers, w)
    }

    this.updateFace(dt, lookYP)
    this.updateProps()
    this.updateTail(dt, moveW)
  }

  // Root-space FK for a bone whose local quaternion and position are set.
  private fk(name: string, parent: string | null) {
    const b = this.rig.bones[name]
    const q = this.rq.get(name)!
    const p = this.rp.get(name)!
    if (!parent) {
      q.copy(b.quaternion)
      p.copy(b.position)
      return
    }
    const pq = this.rq.get(parent)!
    q.copy(pq).multiply(b.quaternion)
    p.copy(b.position).applyQuaternion(pq).add(this.rp.get(parent)!)
  }

  private setRootQuat(name: string, parent: string, desired: THREE.Quaternion) {
    const b = this.rig.bones[name]
    b.quaternion.copy(this.rq.get(parent)!).invert().multiply(desired)
    this.fk(name, parent)
  }

  private solve2(S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, E: THREE.Vector3, Tout: THREE.Vector3) {
    const d = this.sd.subVectors(T, S)
    let dist = d.length()
    d.divideScalar(dist || 1)
    dist = clamp(dist, Math.abs(a - b) + 1e-4, (a + b) * 0.9985)
    const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1)
    const sinA = Math.sqrt(1 - cosA * cosA)
    const p = this.tmpPole.copy(pole).addScaledVector(d, -pole.dot(d))
    if (p.lengthSq() < 1e-8) p.set(0, 0, 1)
    p.normalize()
    E.copy(S).addScaledVector(d, a * cosA).addScaledVector(p, a * sinA)
    Tout.copy(S).addScaledVector(d, dist)
  }
  private tmpPole = V()
  private sd = V()
  private bend = V()
  private aHand = V()
  private aF = V()
  private aP = V()
  private aPole = V()
  private E = V()
  private T = V()
  private segD = V()
  private qA = Q()
  private qB = Q()

  private solveLeg(side: Side, ankle: THREE.Vector3, pitch: number, toe: number, yaw: number) {
    const r = this.rig
    const thighN = `thigh_${side}`, shinN = `shin_${side}`, footN = `foot_${side}`, toeN = `toe_${side}`
    r.bones[thighN].quaternion.identity()
    this.fk(thighN, 'hips')
    const S = this.rp.get(thighN)!
    const pole = this.v2.set(Math.sin(yaw) + (side === 'L' ? 0.12 : -0.12), 0, Math.cos(yaw))
    this.solve2(S, ankle, this.bind.thigh[side], this.bind.shin[side], pole, this.E, this.T)
    this.limbBend(S, pole)
    this.segD.subVectors(this.E, S).normalize()
    basisQuat(this.segD, this.bend, this.qA).multiply(this.bind.thighBasisInv[side])
    this.setRootQuat(thighN, 'hips', this.qA)
    this.segD.subVectors(this.T, this.E).normalize()
    basisQuat(this.segD, this.bend, this.qB).multiply(this.bind.shinBasisInv[side])
    this.setRootQuat(shinN, thighN, this.qB)
    this.tmpE.set(pitch, yaw + (side === 'L' ? 0.08 : -0.08), 0, 'YXZ')
    this.tmpQ.setFromEuler(this.tmpE)
    this.setRootQuat(footN, shinN, this.tmpQ)
    this.tmpE.set(toe, 0, 0)
    r.bones[toeN].quaternion.setFromEuler(this.tmpE)
  }

  // Direction from the root-to-tip line toward the middle joint (falls back to the pole).
  private limbBend(S: THREE.Vector3, pole: THREE.Vector3) {
    this.bend.copy(S).lerp(this.T, 0.5)
    this.bend.subVectors(this.E, this.bend)
    if (this.bend.lengthSq() < 1e-10) this.bend.copy(pole)
    this.bend.normalize()
  }

  private wristFix = V()
  private solveArm(side: Side, hand: THREE.Vector3, fdir: THREE.Vector3, palm: THREE.Vector3, pole: THREE.Vector3, clav: number) {
    const r = this.rig
    const sg = side === 'L' ? 1 : -1
    const clavN = `clavicle_${side}`, upN = `upperArm_${side}`, foN = `forearm_${side}`, haN = `hand_${side}`
    // Clavicle lifts and protracts toward high or forward targets.
    const chestP = this.rp.get('chest')!
    const rel = this.v3.subVectors(hand, chestP)
    const lift = clamp((rel.y - 0.1 * this.s) / (0.35 * this.s), 0, 1) * 0.28 + clav
    const fwd = clamp(rel.z / (0.5 * this.s), 0, 1) * 0.15
    this.tmpE.set(0, -fwd * sg, lift * sg, 'YXZ')
    r.bones[clavN].quaternion.setFromEuler(this.tmpE)
    this.fk(clavN, 'chest')
    r.bones[upN].quaternion.identity()
    this.fk(upN, clavN)
    const S = this.rp.get(upN)!
    this.solve2(S, hand, this.bind.upper[side], this.bind.fore[side], pole, this.E, this.T)
    // The bind frames use the direction the elbow points as their second axis.
    this.limbBend(S, pole)
    this.segD.subVectors(this.E, S).normalize()
    basisQuat(this.segD, this.bend, this.qA).multiply(this.bind.upperBasisInv[side])
    this.setRootQuat(upN, clavN, this.qA)
    const foreD = this.sd.subVectors(this.T, this.E).normalize()
    basisQuat(foreD, this.bend, this.qB).multiply(this.bind.foreBasisInv[side])
    this.setRootQuat(foN, upN, this.qB)
    // Hand orientation, with the wrist bend limited relative to the forearm.
    const f = this.wristFix.copy(fdir)
    const ang = f.angleTo(foreD)
    if (ang > 1.15) f.lerp(foreD, 1 - 1.15 / ang).normalize()
    basisQuat(f, this.v3.copy(palm).negate(), this.tmpQ).multiply(this.bind.handBasisInv[side])
    this.setRootQuat(haN, foN, this.tmpQ)
  }

  private fingerTmp = { c: [0, 0, 0, 0, 0], opp: 0, spread: 0 }
  private poseFingers(side: Side, a: Fingers, b: Fingers, w: number) {
    const r = this.rig
    const fp = this.fingerTmp
    const jitter = (i: number) => Math.sin(this.t * (0.9 + i * 0.37) + this.seed * 1.7 + i) * 0.035
    for (let i = 0; i < 5; i++) fp.c[i] = clamp(THREE.MathUtils.lerp(a.c[i], b.c[i], w) + jitter(i), 0, 1)
    fp.opp = THREE.MathUtils.lerp(a.opp, b.opp, w)
    fp.spread = THREE.MathUtils.lerp(a.spread, b.spread, w)
    // Typing flutter
    const typing = (this.gw.get('typing') ?? 0) * w
    const sg = this.bind.sideSign[side]
    const MAXA = [1.35, 1.6, 1.05]
    const SPREAD = [0, 0.16, 0.02, -0.1, -0.22]
    FINGERS.forEach((f, fi) => {
      for (let i = 0; i < 3; i++) {
        const bone = r.bones[`${f}${i + 1}_${side}`]
        let curl = fp.c[fi]
        if (typing > 0 && fi > 0) curl += typing * 0.35 * Math.max(0, Math.sin(this.t * (13 + fi * 2.3) + fi * 1.9 + (side === 'L' ? 0 : 1.3)))
        const axis = this.bind.curlAxis[side][fi][i]
        if (f === 'thumb') {
          const angles = [0.25, 0.55, 0.85]
          bone.quaternion.setFromAxisAngle(axis, curl * angles[i])
          if (i === 0) {
            this.tmpQ.setFromAxisAngle(this.bind.oppAxis[side], fp.opp * 0.85 * sg)
            bone.quaternion.premultiply(this.tmpQ)
          }
        } else {
          bone.quaternion.setFromAxisAngle(axis, curl * MAXA[i] * (i === 2 ? 0.9 : 1))
          if (i === 0) {
            this.tmpQ.setFromAxisAngle(this.bind.spreadAxis[side], SPREAD[fi] * fp.spread * sg)
            bone.quaternion.premultiply(this.tmpQ)
          }
        }
      }
    })
  }

  private locomotionArms(ph: number, moveW: number, runW: number, crouch: number, sitW: number) {
    const L = this.loco
    const swing = Math.cos(ph * 2 * Math.PI)
    for (const side of SIDES) {
      const sg = side === 'L' ? 1 : -1
      const sw = swing * sg * -1
      const a = L.arm[side]
      // Hanging arm with a subtle idle sway
      a.hand.set(0.215 * sg, -0.33, 0.035 + Math.sin(this.t * 0.8 + this.seed + sg) * 0.004)
      a.fdir.set(0.06 * sg, -1, 0.14).normalize()
      a.palm.set(-sg, 0, 0.15).normalize()
      a.pole.set(0.3 * sg, -0.3, -1).normalize()
      a.clav = 0
      a.fingers = POSE.relaxed
      // Walk: swing forward and back with an elbow lag
      if (moveW > 0) {
        const z = sw * (0.15 * (1 - runW))
        a.hand.x = THREE.MathUtils.lerp(a.hand.x, (0.2 - Math.max(0, z) * 0.2) * sg, moveW)
        a.hand.y = THREE.MathUtils.lerp(a.hand.y, -0.32 + Math.max(0, z) * 0.25, moveW)
        a.hand.z = THREE.MathUtils.lerp(a.hand.z, 0.03 + z, moveW)
        a.fdir.lerp(this.v1.set(0.05 * sg, -1, 0.15 + z * 2.2).normalize(), moveW).normalize()
        // Run: elbows at ~90 degrees pumping, loose fists
        if (runW > 0) {
          const rz = sw * 0.2
          this.v2.set(0.17 * sg, -0.17 + Math.max(0, rz) * 0.35, 0.1 + rz)
          a.hand.lerp(this.v2, runW)
          a.fdir.lerp(this.v1.set(-0.35 * sg, 0.25, 1).normalize(), runW).normalize()
          a.palm.lerp(this.v1.set(-sg, 0.2, 0), runW).normalize()
          a.fingers = runW > 0.5 ? POSE.grip : POSE.relaxed
        }
      }
      if (crouch > 0.01) {
        a.hand.lerp(this.v2.set(0.2 * sg, -0.28, 0.17), crouch)
        a.fdir.lerp(this.v1.set(0, -0.7, 0.7).normalize(), crouch).normalize()
      }
      // Fidget: rub hands or adjust a strap now and then when idle.
      const fid = Math.sin(Math.min(1, this.fidget) * Math.PI) * (1 - moveW) * (1 - sitW)
      if (fid > 0) {
        a.hand.lerp(this.v2.set(0.05 * sg, -0.24, 0.17), fid * 0.8)
        a.fdir.lerp(this.v1.set(-sg, 0.1, 0.4).normalize(), fid * 0.8).normalize()
        a.palm.lerp(this.v1.set(-sg, 0, 0), fid).normalize()
        a.pole.lerp(this.v1.set(sg, -0.6, -0.2), fid).normalize()
        a.hand.y += Math.sin(this.t * 9) * 0.008 * fid
      }
    }
  }

  // Gesture frames blended by weight (chest space unless marked root).
  private blendGestures(dt: number): Frame {
    const acc = this.frameAcc
    const base = emptyFrame()
    for (const side of SIDES) {
      const a = acc.arm[side]
      const b = base.arm[side]
      a.hand.set(0, 0, 0)
      a.fdir.set(0, 0, 0)
      a.palm.set(0, 0, 0)
      a.pole.set(0, 0, 0)
      a.clav = 0
      a.fingers = { c: [0, 0, 0, 0, 0], opp: 0, spread: 0 }
      acc.armW[side] = 0
      void b
    }
    acc.spine.set(0, 0, 0)
    acc.head.set(0, 0, 0)
    acc.hipsDrop = 0
    acc.hipsZ = 0
    acc.feetZ = 0
    let total = 0
    for (const [g, w] of this.gw) {
      if (g === 'none' || w < 0.001) continue
      const f = this.gestureFrame(g, dt)
      total += w
      acc.spine.addScaledVector(f.spine, w)
      acc.head.addScaledVector(f.head, w)
      acc.hipsDrop += f.hipsDrop * w
      acc.hipsZ += f.hipsZ * w
      acc.feetZ += f.feetZ * w
      for (const side of SIDES) {
        const ww = w * f.armW[side]
        const a = acc.arm[side]
        const fa = f.arm[side]
        if (f.space === 'root') this.rootToChest(fa)
        a.hand.addScaledVector(fa.hand, ww)
        a.fdir.addScaledVector(fa.fdir, ww)
        a.palm.addScaledVector(fa.palm, ww)
        a.pole.addScaledVector(fa.pole, ww)
        a.clav += fa.clav * ww
        for (let i = 0; i < 5; i++) a.fingers.c[i] += fa.fingers.c[i] * ww
        a.fingers.opp += fa.fingers.opp * ww
        a.fingers.spread += fa.fingers.spread * ww
        acc.armW[side] += ww
      }
    }
    for (const side of SIDES) {
      const a = acc.arm[side]
      const ww = acc.armW[side]
      if (ww > 1e-4) {
        a.hand.divideScalar(ww)
        a.fdir.normalize()
        a.palm.normalize()
        a.pole.normalize()
        a.clav /= ww
        for (let i = 0; i < 5; i++) a.fingers.c[i] /= ww
        a.fingers.opp /= ww
        a.fingers.spread /= ww
      } else {
        a.hand.copy(this.loco.arm[side].hand)
        a.fdir.copy(this.loco.arm[side].fdir)
        a.palm.copy(this.loco.arm[side].palm)
        a.pole.copy(this.loco.arm[side].pole)
        a.fingers = POSE.relaxed
      }
      acc.armW[side] = Math.min(1, ww)
    }
    void total
    return acc
  }

  // Root-space arm pose (scale 1) to chest space using the current chest transform.
  private rootToChest(a: ArmPose) {
    const s = this.s
    const q = this.tmpQ2.copy(this.rq.get('chest') ?? this.tmpQ2.identity()).invert()
    const p = this.rp.get('chest')!
    a.hand.multiplyScalar(s).sub(p).applyQuaternion(q).divideScalar(s)
    a.fdir.applyQuaternion(q)
    a.palm.applyQuaternion(q)
    a.pole.applyQuaternion(q)
  }

  private gestureFrame(g: Gesture, _dt: number): Frame {
    const f = this.frameTmp
    const t = this.t
    const rest = emptyFrame()
    f.space = 'chest'
    f.spine.set(0, 0, 0)
    f.head.set(0, 0, 0)
    f.hipsDrop = 0
    f.hipsZ = 0
    f.feetZ = 0
    f.armW.L = 0
    f.armW.R = 0
    f.arm.L = rest.arm.L
    f.arm.R = rest.arm.R
    const set = (side: Side, a: ArmPose, w = 1) => {
      f.arm[side] = a
      f.armW[side] = w
    }
    switch (g) {
      case 'talk': {
        // Beat gestures: alternating hands, palms open toward the listener.
        const k = this.talking ? 1 : 0.4
        const b1 = Math.sin(t * 3.1 + this.seed) * 0.5 + Math.sin(t * 5.3) * 0.25
        const b2 = Math.sin(t * 2.7 + 1.7 + this.seed) * 0.5 + Math.sin(t * 4.1 + 0.5) * 0.25
        set('L', arm([0.15 + b1 * 0.03 * k, -0.19 + Math.max(0, b1) * 0.07 * k, 0.21 + b1 * 0.03 * k], [-0.35, 0.15, 1], [-0.45, 0.75, 0.45], [0.7, -0.6, -0.4], POSE.open), 0.95)
        set('R', arm([-0.16 + b2 * 0.03 * k, -0.2 + Math.max(0, b2) * 0.08 * k, 0.22 + b2 * 0.03 * k], [0.35, 0.15, 1], [0.45, 0.75, 0.45], [-0.7, -0.6, -0.4], POSE.open), 0.95)
        f.head.set(0, Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.6) * 0.04)
        break
      }
      case 'reach': {
        const k = Math.sin(clamp(this.reachT / 0.75, 0, 1) * Math.PI)
        set('R', arm([-0.11, -0.04, 0.46], [0.05, 0.1, 1], [0, 1, 0.1], [-0.6, -0.8, -0.2], POSE.open), k)
        f.spine.set(0.08 * k, -0.1 * k, 0)
        break
      }
      case 'stamp': {
        const c = (t * 1.1) % 1
        const up = c < 0.55 ? ss(0, 0.55, c) : 1 - ss(0.55, 0.68, c)
        set('R', arm([-0.12, -0.24 + up * 0.28, 0.4 - up * 0.03], [0.05, -0.2, 1], [1, 0, 0], [-0.8, -0.5, -0.3], POSE.grip), 1)
        set('L', arm([0.12, -0.25, 0.38], [-0.3, -0.2, 1], [0, -1, 0], [0.6, -0.8, -0.2], POSE.flat), 0.9)
        f.spine.set(0.12 + up * -0.04, 0, 0)
        f.head.set(0.25, 0, 0)
        break
      }
      case 'wave': {
        const wv = Math.sin(t * 9)
        set('R', arm([-0.3 + wv * 0.025, 0.36, 0.1], [0.25 * wv, 1, 0.1], [0, 0, 1], [-1, -0.2, -0.3], POSE.open, 0.1), 1)
        f.head.set(0, 0, -0.05)
        break
      }
      case 'point': {
        set('R', arm([-0.13, 0.12, 0.47], [0.05, 0.08, 1], [0.6, -0.8, 0], [-0.7, -0.7, -0.1], POSE.point), 1)
        f.spine.set(0.03, -0.12, 0)
        break
      }
      case 'cheer': {
        const pump = Math.abs(Math.sin(t * 4.2 + this.seed))
        set('R', arm([-0.21, 0.27 + pump * 0.18, 0.08], [0, 1, 0.1], [0.6, 0, 0.8], [-1, -0.3, -0.2], POSE.fist, 0.15), 1)
        set('L', arm([0.2, -0.2, 0.14], [0, -0.5, 0.8], [-1, 0, 0], [0.6, -0.6, -0.4], POSE.fist), 0.6)
        f.head.set(-0.12 + pump * 0.05, 0, 0)
        break
      }
      case 'decree': {
        const sway = Math.sin(t * 1.3) * 0.03
        set('R', arm([-0.25 + sway, 0.6, 0.12], [0.05, 1, 0.15], [0, 0.2, 1], [-1, -0.3, -0.2], POSE.grip, 0.12), 1)
        set('L', arm([0.19, -0.13, 0.32], [-0.2, -0.4, 1], [0, -1, 0], [0.6, -0.8, -0.2], POSE.fist), 0.9)
        f.head.set(-0.12, 0.08, 0)
        f.spine.set(-0.05, 0, 0)
        break
      }
      case 'crossArms': {
        set('L', arm([-0.12, -0.02, 0.15], [-1, 0.3, -0.1], [0, 0, -1], [1, -0.4, 0.3], POSE.cup), 1)
        set('R', arm([0.13, -0.05, 0.11], [1, 0.35, 0], [0, 0, -1], [-1, -0.4, 0.3], POSE.cup), 1)
        f.head.set(-0.04, 0, 0.04)
        f.spine.set(-0.03, 0, 0)
        break
      }
      case 'sit': {
        f.space = 'root'
        f.hipsDrop = 0.43
        f.hipsZ = -0.02
        f.feetZ = 0
        const elbows = this.seed % 2 === 0
        if (elbows) {
          set('L', arm([0.05, 0.62, 0.36], [-0.6, -0.4, 0.7], [-0.3, -0.6, -0.5], [0.4, -1, -0.2], POSE.relaxed), 1)
          set('R', arm([-0.05, 0.62, 0.36], [0.6, -0.4, 0.7], [0.3, -0.6, -0.5], [-0.4, -1, -0.2], POSE.relaxed), 1)
          f.spine.set(0.32, 0, 0)
          f.head.set(-0.2, 0, 0)
        } else {
          set('L', arm([0.15, 0.56, 0.33], [0, -0.55, 1], [0, -1, 0.2], [0.6, -0.4, -0.6], POSE.relaxed), 1)
          set('R', arm([-0.15, 0.56, 0.33], [0, -0.55, 1], [0, -1, 0.2], [-0.6, -0.4, -0.6], POSE.relaxed), 1)
          f.spine.set(0.14, 0, 0)
          f.head.set(-0.08, 0, 0)
        }
        break
      }
      case 'salute': {
        set('R', arm([-0.19, 0.36, 0.085], [0.8, 0.45, 0.1], [0.1, -0.75, 0.65], [-1, 0.15, 0.25], POSE.flat, 0.08), 1)
        set('L', arm([0.21, -0.33, 0.02], [0, -1, 0], [-1, 0, 0], [0.3, -0.3, -1], POSE.flat), 0.8)
        f.spine.set(-0.06, 0, 0)
        f.head.set(-0.05, 0, 0)
        break
      }
      case 'fistRaise': {
        const pulse = Math.sin(t * 2.2) * 0.02
        set('R', arm([-0.23, 0.6 + pulse, 0.05], [0.05, 1, 0.05], [1, 0, 0.25], [-1, -0.2, -0.2], POSE.fist, 0.18), 1)
        f.head.set(-0.15, -0.08, 0)
        f.spine.set(-0.06, -0.06, 0.04)
        break
      }
      case 'podium': {
        // Hands on the podium edge, with a periodic point or fist at the crowd.
        const c = (t * 0.33 + this.seed * 0.1) % 1
        const act = ss(0.55, 0.62, c) * (1 - ss(0.88, 0.95, c))
        const pointIt = Math.floor(t * 0.33 + this.seed * 0.1) % 2 === 0
        set('L', arm([0.2, -0.13, 0.33], [-0.1, -0.35, 1], [0, -1, 0.1], [0.7, -0.6, -0.3], POSE.relaxed), 1)
        const onPodium = arm([-0.2, -0.13, 0.33], [0.1, -0.35, 1], [0, -1, 0.1], [-0.7, -0.6, -0.3], POSE.relaxed)
        const gesture = pointIt
          ? arm([-0.16, 0.1, 0.45], [0.1, 0.1, 1], [0.6, -0.8, 0], [-0.7, -0.7, -0.1], POSE.point)
          : arm([-0.18, -0.06 - Math.abs(Math.sin(t * 6)) * 0.07, 0.36], [0.1, -0.2, 1], [1, 0, 0], [-0.8, -0.5, -0.3], POSE.fist)
        onPodium.hand.lerp(gesture.hand, act)
        onPodium.fdir.lerp(gesture.fdir, act).normalize()
        onPodium.palm.lerp(gesture.palm, act).normalize()
        onPodium.fingers = act > 0.5 ? gesture.fingers : POSE.relaxed
        set('R', onPodium, 1)
        f.spine.set(0.1, -0.05 * act, 0)
        f.head.set(-0.06, Math.sin(t * 0.5) * 0.25, 0)
        break
      }
      case 'shrug': {
        set('L', arm([0.3, -0.17, 0.17], [0.8, 0.05, 0.6], [0, 1, 0], [0.6, -0.8, -0.2], POSE.open, 0.35), 1)
        set('R', arm([-0.3, -0.17, 0.17], [-0.8, 0.05, 0.6], [0, 1, 0], [-0.6, -0.8, -0.2], POSE.open, 0.35), 1)
        f.head.set(0.05, 0, 0.12)
        break
      }
      case 'facepalm': {
        set('R', arm([-0.03, 0.31, 0.2], [0.1, 1, 0.05], [0, -0.1, -1], [-0.8, -0.6, 0], POSE.cup), 1)
        set('L', arm([0.06, -0.1, 0.14], [-0.6, 0.6, 0.3], [0, 0.4, -1], [0.9, -0.4, -0.1], POSE.relaxed), 0.8)
        f.head.set(0.32, 0, 0.05)
        f.spine.set(0.12, 0, 0)
        break
      }
      case 'typing': {
        set('L', arm([0.085, -0.215, 0.27], [-0.1, -0.25, 1], [0, -1, 0.1], [0.8, -0.5, -0.3], POSE.typing), 1)
        set('R', arm([-0.085, -0.215, 0.27], [0.1, -0.25, 1], [0, -1, 0.1], [-0.8, -0.5, -0.3], POSE.typing), 1)
        f.head.set(0.28, 0, 0)
        f.spine.set(0.08, 0, 0)
        break
      }
      case 'thinking': {
        set('R', arm([-0.035, 0.2, 0.15], [0.15, 1, 0.15], [0, 0.1, -1], [-0.6, -0.8, 0], { c: [0.4, 0.55, 0.8, 0.9, 0.95], opp: 0.5, spread: 0 }), 1)
        set('L', arm([-0.09, -0.08, 0.13], [-1, 0.2, 0.1], [0, 1, 0], [0.9, -0.5, 0.2], POSE.cup), 1)
        f.head.set(-0.06, 0.12, 0.08)
        break
      }
      case 'none':
        break
    }
    return f
  }

  private lookOut = new THREE.Vector2()
  // Yaw/pitch toward the look target relative to the body (radians), smoothed for the head.
  private computeLook(dt: number): THREE.Vector2 {
    let ty = 0, tp = 0
    if (this.hasLook) {
      const p = this.v1.copy(this.lookTarget).applyMatrix4(this.rootInv)
      const hp = this.rig.bindPos.head
      p.sub(this.v2.set(0, hp.y + 0.1 * this.s, 0))
      ty = Math.atan2(p.x, p.z)
      tp = Math.atan2(p.y, Math.hypot(p.x, p.z))
      if (Math.abs(ty) > 1.9) ty = 0
      ty = clamp(ty, -1.15, 1.15)
      tp = clamp(tp, -0.5, 0.45)
    } else {
      // Idle glances around now and then.
      this.glanceT -= dt
      if (this.glanceT < 0) {
        const away = this.glance.lengthSq() < 0.001
        this.glance.set(away ? (((this.seed * 13 + this.t * 31) % 1) - 0.5) * 0.9 : 0, away ? (((this.seed * 7 + this.t * 17) % 1) - 0.5) * 0.25 : 0)
        this.glanceT = away ? 1 + ((this.t * 3) % 1.5) : 4 + ((this.seed + this.t * 5) % 5)
      }
      ty = this.glance.x * (1 - ss(0.05, 0.6, this.speed))
      tp = this.glance.y * (1 - ss(0.05, 0.6, this.speed))
    }
    this.headYaw += (ty - this.headYaw) * damp(4.5, dt)
    this.headPitch += (tp - this.headPitch) * damp(4.5, dt)
    // Eyes lead: they reach the target faster than the head.
    this.eyeYaw += (ty - this.headYaw - this.eyeYaw + this.saccade.x) * damp(28, dt)
    this.eyePitch += (tp - this.headPitch - this.eyePitch + this.saccade.y) * damp(28, dt)
    return this.lookOut.set(this.headYaw, this.headPitch)
  }

  private updateFace(dt: number, _look: THREE.Vector2) {
    const r = this.rig
    const fc = r.face
    // Saccades
    this.saccadeT -= dt
    if (this.saccadeT < 0) {
      const h = Math.sin(this.t * 91.7 + this.seed * 13.1)
      const k = Math.sin(this.t * 53.3 + this.seed * 7.3)
      this.saccade.set(h * 0.07, k * 0.035)
      this.saccadeT = 0.4 + Math.abs(Math.sin(this.t * 17.1 + this.seed)) * 2
    }
    // Blinks (occasional doubles)
    this.blinkT -= dt
    if (this.blinkT < 0) {
      this.blink = 1
      if (this.blinkQueue > 0) {
        this.blinkQueue--
        this.blinkT = 0.22
      } else {
        this.blinkQueue = Math.sin(this.t * 7.7 + this.seed) > 0.7 ? 1 : 0
        this.blinkT = 2.2 + Math.abs(Math.sin(this.t * 3.3 + this.seed * 5)) * 3.5
      }
    }
    this.blink = Math.max(0, this.blink - dt / 0.16)
    const blinkClose = this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0

    // Expression targets
    const target = EXPRESSIONS[this.expression]
    for (const k of FACE_KEYS) {
      const cur = this.face.get(k) ?? 0
      this.face.set(k, cur + ((target[k] ?? 0) - cur) * damp(9, dt))
    }

    // Speech visemes: syllables with natural rhythm and pauses between words.
    const vis = this.viseme
    const vt = this.visemeT
    if (this.talking) {
      this.syllT -= dt
      this.pauseT -= dt
      if (this.syllT < 0) {
        this.syll++
        const rnd = (n: number) => Math.abs(Math.sin(this.syll * 12.9898 + this.seed * 78.233 + n * 37.719)) % 1
        if (this.pauseT < 0 && rnd(1) > 0.82) {
          this.pauseT = 0.12 + rnd(2) * 0.3
          vt[0] = 0.04
          vt[1] = 0
          vt[2] = 0
          vt[3] = rnd(5) > 0.5 ? 0.6 : 0
          this.syllT = this.pauseT
        } else {
          const kind = Math.floor(rnd(3) * 6)
          // A, E, O, U, M-B-P, F-V
          const table = [
            [0.75, 0.25, 0, 0],
            [0.35, 0.8, 0, 0],
            [0.55, 0, 0.8, 0],
            [0.2, 0, 1, 0],
            [0, 0, 0, 1],
            [0.15, 0.35, 0, 0.45],
          ][kind]
          const amp = 0.65 + rnd(4) * 0.45
          for (let i = 0; i < 4; i++) vt[i] = table[i] * amp
          this.syllT = 0.075 + rnd(6) * 0.1
          if (rnd(7) > 0.9) this.emphasis = 1
        }
      }
    } else {
      vt[0] = vt[1] = vt[2] = vt[3] = 0
    }
    for (let i = 0; i < 4; i++) vis[i] += (vt[i] - vis[i]) * damp(26, dt)
    this.emphasis = Math.max(0, this.emphasis - dt * 2.5)
    this.nod += ((this.talking ? Math.sin(this.t * 4.3) * 0.025 + this.emphasis * 0.05 : 0) - this.nod) * damp(6, dt)

    const F = (k: FaceKey) => this.face.get(k) ?? 0
    const infl: Record<string, number> = {
      jawOpen: clamp(F('jawOpen') + vis[0] * 0.55, 0, 1),
      mouthWide: clamp(F('mouthWide') + vis[1] * 0.7, 0, 1),
      mouthRound: clamp(F('mouthRound') + vis[2] * 0.7, 0, 1),
      mouthPress: clamp(F('mouthPress') + vis[3], 0, 1),
      smileL: clamp(F('smileL') + (this.rig.look.restSmile ?? 0) * 0.8, 0, 1),
      smileR: clamp(F('smileR') + (this.rig.look.restSmile ?? 0) * 0.35, 0, 1),
      frown: F('frown'),
      cheekRaise: clamp(F('cheekRaise') + (this.rig.look.restSmile ?? 0) * 0.3, 0, 1),
    }
    for (const m of [fc.head, fc.beard]) {
      if (!m || !m.morphTargetInfluences) continue
      MORPHS.forEach((name, i) => (m.morphTargetInfluences![i] = infl[name]))
    }
    fc.jaw.rotation.x = infl.jawOpen * 0.26

    // Eyes and lids
    const ey = clamp(this.eyeYaw, -0.6, 0.6)
    const ep = clamp(this.eyePitch, -0.35, 0.35)
    for (let i = 0; i < 2; i++) {
      fc.eyes[i].rotation.set(-ep, ey, 0, 'YXZ')
      const squint = F('squint') + F('cheekRaise') * 0.2
      const closed = clamp(Math.max(blinkClose, squint * 0.22 + F('droop') * 0.35) - F('wide') * 0.25, -0.2, 1)
      fc.lidU[i].rotation.x = THREE.MathUtils.lerp(-0.4, 0.72, closed) - ep * 0.55
      fc.lidL[i].rotation.x = -0.16 * (squint + F('cheekRaise')) - ep * 0.2 - blinkClose * 0.1
    }
    // Brows
    const s = this.s
    const em = this.emphasis
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1
      const b = fc.brows[i]
      const rest = b.userData.rest as THREE.Vector3
      const up = F('browUp') + (i === 0 ? F('browUpL') : 0) + em * 0.6 + (this.talking ? 0.12 * Math.max(0, Math.sin(this.t * 1.7)) : 0)
      const furrow = F('furrow')
      const inner = F('inner')
      b.position.set(rest.x - furrow * 0.0025 * s * sg, rest.y + (up * 0.0072 - furrow * 0.0032) * s, rest.z)
      b.rotation.z = sg * (-inner * 0.36 + furrow * 0.22)
    }
  }

  private updateProps() {
    const p = this.rig.props
    p.stamp.visible = (this.gw.get('stamp') ?? 0) > 0.5
    p.paper.visible = (this.gw.get('decree') ?? 0) > 0.5
    p.laptop.visible = (this.gw.get('typing') ?? 0) > 0.5
  }

  private updateTail(dt: number, moveW: number) {
    const tail = this.rig.tail
    if (!tail) return
    const hp = this.rp.get('head')!
    this.headVel.subVectors(hp, this.prevHead).divideScalar(dt)
    this.prevHead.copy(hp)
    const tx = 0.25 + clamp(this.headVel.z * 0.35, -0.4, 0.4) + clamp(-this.headVel.y * 0.4, -0.3, 0.3)
    const tz = clamp(this.headVel.x * 0.4, -0.4, 0.4) + this.turnRate * 0.06
    this.tailV.x += ((tx - this.tailA.x) * 60 - this.tailV.x * 7) * dt
    this.tailV.y += ((tz - this.tailA.y) * 60 - this.tailV.y * 7) * dt
    this.tailA.x += this.tailV.x * dt
    this.tailA.y += this.tailV.y * dt
    tail.rotation.set(this.tailA.x + Math.sin(this.phase * 4 * Math.PI) * 0.06 * moveW, 0, this.tailA.y)
  }
}

