import type * as THREE from 'three'

export type CharacterId = 'vale' | 'andres' | 'camila' | 'president' | 'rector' | 'clerk' | 'student' | 'soldier'

export type Gesture =
  | 'none'
  | 'talk'
  | 'reach'
  | 'stamp'
  | 'wave'
  | 'point'
  | 'cheer'
  | 'decree'
  | 'crossArms'
  | 'sit'
  // Added for the president and richer dialogue staging
  | 'salute'
  | 'fistRaise'
  | 'podium'
  | 'shrug'
  | 'facepalm'
  | 'typing'
  | 'thinking'

export type Expression = 'neutral' | 'smile' | 'smug' | 'angry' | 'sad' | 'surprised' | 'worried' | 'determined'

// Imperative handle every procedural humanoid exposes. The rig animates itself every frame;
// callers only set intent. Origin at the feet, facing +z in local space, ~1.75 m tall.
export type HumanoidHandle = {
  root: THREE.Group
  // 0 = still, ~1.4 = walk, ~4.5 = run (m/s). Drives the gait blend.
  setSpeed: (metersPerSecond: number) => void
  setCrouch: (crouched: boolean) => void
  setGesture: (gesture: Gesture) => void
  // Mouth moves with speech-like visemes while true.
  setTalking: (talking: boolean) => void
  setExpression: (expression: Expression) => void
  // World position the head and eyes turn toward, or null to look ahead.
  lookAt: (target: THREE.Vector3 | null) => void
}
