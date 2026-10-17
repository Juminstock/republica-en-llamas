import * as THREE from 'three'
import type { Look } from './looks'
import { MAT_CLOTH, MAT_LEATHER, MAT_SKIN } from './materials'
import { MOUTH_Y } from './head'

export type Paint = { color: THREE.Color; mat: number }

const C = (hex: string) => new THREE.Color(hex)
const has = (look: Look, a: Look['accessories'][number]) => look.accessories.includes(a)

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Sash bands of the Colombian flag (yellow double width), across the torso from the right shoulder.
function sashColor(x: number, y: number): THREE.Color | null {
  const ax = -0.165, ay = 1.42
  const dx = 0.56, dy = -0.828
  const nx = 0.828, ny = 0.56
  const t = (x - ax) * dx + (y - ay) * dy
  if (t < -0.02 || t > 0.62) return null
  const n = (x - ax) * nx + (y - ay) * ny
  if (n < -0.042 || n > 0.042) return null
  // Gold emblem near the hip
  if (Math.hypot(x - 0.115, y - 1.0) < 0.024) return C('#c9a24a')
  if (n < 0) return C('#f2c600')
  if (n < 0.021) return C('#1d3d9a')
  return C('#c8102e')
}

function bandDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const l = Math.hypot(dx, dy)
  return Math.abs((x - ax) * dy - (y - ay) * dx) / l
}

// Clothing and skin color for a body surface point in the bind pose (meters at scale 1).
export function paintBody(look: Look, tag: string, x: number, y: number, z: number, wristDist: number, shoulderDist: number): Paint {
  const skin = C(look.skin)
  const top = C(look.top)
  const bottom = C(look.bottom)
  const inner = look.inner ? C(look.inner) : null
  const suit = has(look, 'suitLapels')
  const blazer = has(look, 'blazerLapels')
  const cardigan = has(look, 'cardigan')
  const coat = has(look, 'labCoat')
  const vest = has(look, 'vest')
  const hood = has(look, 'hood')
  const tactical = has(look, 'tacticalVest')
  const open = suit || blazer || cardigan
  const ax = Math.abs(x)
  const cloth = (c: THREE.Color): Paint => ({ color: c, mat: MAT_CLOTH })
  const leather = (c: THREE.Color): Paint => ({ color: c, mat: MAT_LEATHER })

  if (tag === 'neck') {
    if (has(look, 'bandana') && y < 1.49) return cloth(C(look.accent ?? '#d7263d'))
    if ((open || vest) && y < 1.462) return cloth(inner ?? C('#f2f0ea'))
    if (hood && y < 1.475) return cloth(top.clone().multiplyScalar(0.92))
    if (tactical && y < 1.455) return cloth(top)
    if (coat && y < 1.44) return cloth(top)
    return { color: skin, mat: MAT_SKIN }
  }

  if (tag === 'foot') {
    const light = look.shoes === '#e8e4dc' || look.shoes === '#e6e1d8'
    if (y < 0.016) return leather(light ? C('#cfcac0') : C('#151515'))
    if (light && y < 0.03) return leather(C('#efece6'))
    return leather(C(look.shoes))
  }

  if (tag === 'thigh' || tag === 'shin') {
    if (y < 0.105) return leather(C(look.shoes))
    return cloth(bottom.clone().multiplyScalar(1 - 0.06 * ss(0.4, 0.6, y) * ss(0.65, 0.5, y)))
  }

  if (tag === 'arm' || tag === 'forearm') {
    const sleeveCol = vest ? C(look.top) : coat ? C(look.top) : top
    if (!look.longSleeves && (tag === 'forearm' || shoulderDist > 0.13)) return { color: skin, mat: MAT_SKIN }
    if (coat && (tag === 'forearm' || shoulderDist > 0.12)) return { color: skin, mat: MAT_SKIN }
    if (tag === 'arm' && has(look, 'armband') && x > 0 && shoulderDist > 0.11 && shoulderDist < 0.155) return cloth(C(look.accent ?? '#d7263d'))
    if ((suit || blazer) && wristDist < 0.016) return cloth(inner ?? C('#f2f0ea'))
    if (wristDist < 0.03 && (hood || cardigan)) return cloth(sleeveCol.clone().multiplyScalar(0.85))
    return cloth(sleeveCol)
  }

  // Torso and pelvis
  // Jackets are cut higher at the front, where the two sides open below the button.
  const frontOpen = (suit || blazer || cardigan) && z > 0.02 ? Math.max(0, 0.06 - ax * 0.45) : 0
  const hem = (suit ? 0.84 : blazer ? 0.87 : cardigan ? 0.87 : hood ? 0.9 : coat ? 0.95 : tactical ? 0.94 : 0.93) + frontOpen
  let garment = y > hem ? top : bottom
  if (vest && y > hem) garment = C(look.accent ?? '#3d5a8a')
  if (tactical && y > 1.02 && y < 1.43) garment = C('#39432a')

  if (y > hem && z > 0) {
    if (open || vest) {
      const vBottom = suit ? 1.1 : blazer ? 1.13 : cardigan ? 1.05 : 1.12
      if (y > vBottom) {
        const half = 0.012 + ((y - vBottom) / (1.47 - vBottom)) * 0.075
        if (ax < half) {
          if (has(look, 'tie') && y < 1.445) {
            const tw = y > 1.415 ? 0.011 : Math.min(0.023, 0.009 + (1.415 - y) * 0.05)
            if (ax < tw) return cloth(C(look.accent && !suit ? look.accent : '#141b33').multiplyScalar(y > 1.415 ? 0.85 : 1))
          }
          return cloth(inner ?? C('#f2f0ea'))
        }
        if ((suit || blazer) && ax < half + 0.026 && y > vBottom + 0.05) garment = top.clone().multiplyScalar(0.8)
      }
    }
    if (coat && y > 1.36) {
      const half = 0.01 + ((y - 1.36) / 0.11) * 0.05
      if (ax < half) return { color: skin, mat: MAT_SKIN }
    }
    if (has(look, 'pocketSquare') && x > 0.074 && x < 0.112 && y > 1.268 && y < 1.292) return cloth(C('#f6f6f4'))
    if (has(look, 'flagPin') && Math.hypot(x - 0.1, y - 1.338) < 0.009) {
      const t = (y - 1.329) / 0.018
      return leather(t > 0.5 ? C('#f2c600') : t > 0.25 ? C('#1d3d9a') : C('#c8102e'))
    }
    if (hood && y > 0.97 && y < 1.12 && ax < 0.1) garment = garment.clone().multiplyScalar(0.88)
    if (hood && y > 1.3 && y < 1.44 && Math.abs(ax - 0.026) < 0.0035) return cloth(C('#ece8e0'))
    if (has(look, 'lanyard') && y > 1.32 && y < 1.45 && Math.abs(ax - (0.03 + (1.45 - y) * 0.22)) < 0.0045) return cloth(C(look.accent ?? '#3d5a8a'))
  }

  if (has(look, 'sash') && y > 0.9) {
    const sc = sashColor(x, y)
    if (sc) return cloth(sc)
  }
  // Bag straps across the chest (front and back)
  if (has(look, 'messengerBag') && y > 0.95 && bandDist(x, y, -0.15, 1.43, 0.17, 0.96) < 0.016) return leather(C('#3b2a1e'))
  if (has(look, 'folderBag') && y > 0.95 && bandDist(x, y, 0.15, 1.43, -0.17, 0.96) < 0.013) return leather(C('#5a3820'))
  if (has(look, 'backpack') && y > 1.02 && y < 1.44 && Math.abs(ax - 0.085) < 0.016) return leather(C('#1d1d22'))
  if (has(look, 'belt') && y > 0.962 && y < 0.99 && (y < hem || !(suit || blazer || cardigan || coat || hood))) {
    if (z > 0.05 && ax < 0.016) return leather(C('#c8b07a'))
    return leather(C('#2a1c14'))
  }
  return cloth(garment)
}

// Skin with nails and slightly lighter palms for the canonical hand space.
export function paintHand(look: Look, tag: string, x: number, y: number, tipDist: number): Paint {
  const skin = C(look.skin)
  if (tag === 'tip' && y > 0.003 && tipDist < 0.013) return { color: skin.clone().lerp(C('#f0d2c8'), 0.55), mat: MAT_SKIN }
  if (y < -0.006 && x > 0.0) return { color: skin.clone().lerp(C('#e8b8a0'), 0.18), mat: MAT_SKIN }
  if (tag === 'wrist' && x < -0.03 && !look.longSleeves) return { color: skin, mat: MAT_SKIN }
  return { color: skin, mat: MAT_SKIN }
}

// Head skin: lips, mouth interior, stubble and a touch of color on cheeks and ears.
export function paintHead(look: Look, tag: string, x: number, y: number, z: number): Paint {
  const skin = C(look.skin)
  const ax = Math.abs(x)
  if (tag === 'neck' && y < -0.05 && (has(look, 'suitLapels') || has(look, 'blazerLapels') || has(look, 'vest') || has(look, 'cardigan'))) {
    return { color: skin, mat: MAT_SKIN }
  }
  // Mouth interior
  if (z < 0.099 && Math.abs(y - MOUTH_Y) < 0.0085 && ax < 0.021) return { color: C('#3b1414'), mat: MAT_SKIN }
  if (tag === 'lips' && z > 0.094) {
    const lip = C(look.lipTint ?? '#a0574c')
    return { color: skin.clone().lerp(lip, 0.62), mat: MAT_SKIN }
  }
  let col = skin.clone()
  // Warmth on cheeks, nose and ears
  const cheek = 1 - ss(0.008, 0.03, Math.hypot(ax - 0.042, y - 0.062, z - 0.085))
  col.lerp(C('#c46a58'), cheek * (look.feminine ? 0.16 : 0.08))
  const nose = 1 - ss(0.004, 0.02, Math.hypot(x, y - 0.06, z - 0.112))
  col.lerp(C('#c46a58'), nose * 0.08)
  if (tag === 'ear') col.lerp(C('#c0685a'), 0.12)
  // Stubble shadow
  if (has(look, 'stubble') || has(look, 'beard')) {
    const top = 0.05 + 0.55 * Math.max(0, ax - 0.02)
    const lipHole = Math.hypot(x / 0.027, (y - MOUTH_Y) / 0.0125) < 1
    if (y < top && y > -0.065 && z > -0.03 && !lipHole) col.lerp(C(look.beardColor ?? '#1a120e'), has(look, 'beard') ? 0.45 : 0.32)
  }
  // Under-eye darkness and eyelid crease
  const under = 1 - ss(0.002, 0.012, Math.hypot(ax - 0.032, (y - 0.085) * 1.6, z - 0.09))
  col.lerp(C('#6b4034'), under * 0.12)
  return { color: col, mat: MAT_SKIN }
}
