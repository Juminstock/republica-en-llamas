import { Field, capsule, ellipsoid, roundCone, smax, smin, sphere, type Prim, type V3 } from './sdf'
import type { FieldLike } from './mesher'

// Face proportions (multipliers around 1) for the head sculpt.
export type FaceShape = {
  feminine: boolean
  jaw: number
  chin: number
  chinFwd: number
  cheek: number
  nose: number
  noseLen: number
  noseW: number
  lips: number
  eyeSize: number
  faceLen: number
  faceW: number
  ear: number
  // Front hairline height (local y, meters at scale 1). Higher = receding.
  hairline: number
  // Extra receding at the temples (M shaped hairline).
  temples: number
}

export const DEFAULT_FACE: FaceShape = {
  feminine: false,
  jaw: 1,
  chin: 1,
  chinFwd: 0,
  cheek: 1,
  nose: 1,
  noseLen: 1,
  noseW: 1,
  lips: 1,
  eyeSize: 1,
  faceLen: 1,
  faceW: 1,
  ear: 1,
  hairline: 0.152,
  temples: 0,
}

// Head-local landmarks at scale 1 (origin at the head bone, +z forward).
export const MOUTH_Y = 0.0245
export const EYE: V3 = [0.0315, 0.099, 0.08]
export const EYE_R = 0.0118

export type HeadBuild = { field: Field; prims: Prim[] }

export function headField(face: FaceShape): HeadBuild {
  const f = new Field()
  const prims: Prim[] = []
  const fw = face.faceW * (face.feminine ? 0.95 : 1)
  const fl = face.faceLen
  const add = (p: Prim, k: number) => {
    prims.push(p)
    f.add(p, k)
  }
  // Cranium and face masses
  add(ellipsoid([0, 0.106, -0.012], [0.077 * fw, 0.092, 0.098], 'head', 'skull'), 0.03)
  add(ellipsoid([0, 0.106, 0.03], [0.067 * fw, 0.06, 0.07], 'head', 'skin'), 0.03)
  add(ellipsoid([0, 0.054 - (fl - 1) * 0.02, 0.034], [0.064 * fw, 0.07 * fl, 0.066], 'head', 'skin'), 0.03)
  // Soft cheeks (fuller on younger faces)
  const cf = face.feminine ? 1.15 : 1
  for (const sg of [1, -1]) add(ellipsoid([0.037 * fw * sg, 0.048, 0.062], [0.025 * cf, 0.023 * cf, 0.026], 'head', 'skin'), 0.028)
  // Jaw and chin
  const jw = face.jaw * (face.feminine ? 0.9 : 1)
  add(ellipsoid([0, 0.016 - (fl - 1) * 0.03, 0.028], [0.053 * jw * fw, 0.041, 0.064], 'head', 'skin'), 0.035)
  for (const sg of [1, -1]) add(sphere([0.045 * jw * fw * sg, 0.026, -0.02], 0.026, 'head', 'skin'), 0.03)
  const chinY = -0.012 - (fl - 1) * 0.04 - (face.chin - 1) * 0.012 + (face.feminine ? 0.006 : 0)
  add(ellipsoid([0, chinY, 0.072 + face.chinFwd * 0.01], [0.025 * face.chin * (face.feminine ? 0.85 : 1), 0.023 * face.chin, 0.022], 'head', 'skin'), 0.022)
  // Cheekbones
  for (const sg of [1, -1]) add(ellipsoid([0.046 * fw * sg, 0.076, 0.055], [0.025, 0.016 * face.cheek, 0.026], 'head', 'skin'), 0.02)
  // Brow ridge
  add(ellipsoid([0, 0.118, 0.081], [0.057 * fw, face.feminine ? 0.011 : 0.013, 0.02], 'head', 'skin'), 0.022)
  // Nose
  const nl = face.noseLen
  const ns = face.nose
  add(roundCone([0, 0.1, 0.094], [0, 0.066 - (nl - 1) * 0.01, 0.112 + (ns - 1) * 0.006], 0.0062 * ns, 0.0088 * ns, 'head', 'skin'), 0.012)
  add(sphere([0, 0.061 - (nl - 1) * 0.01, 0.1105 + (ns - 1) * 0.006], 0.0108 * ns, 'head', 'skin'), 0.01)
  for (const sg of [1, -1]) add(sphere([0.0108 * face.noseW * sg, 0.0565 - (nl - 1) * 0.008, 0.1], 0.0074 * face.noseW, 'head', 'skin'), 0.009)
  // Upper lip mass and lips
  add(ellipsoid([0, 0.038, 0.098], [0.022, 0.012, 0.011], 'head', 'skin'), 0.012)
  const lp = face.lips * (face.feminine ? 1.02 : 1)
  const lw = face.feminine ? 0.0182 : 0.019
  add(ellipsoid([0, 0.0302, 0.1035], [lw, 0.005 * lp, 0.0088], 'head', 'lips', [0.18, 0, 0]), 0.006)
  for (const sg of [1, -1]) add(ellipsoid([0.006 * sg, 0.0312, 0.1045], [0.008, 0.0045 * lp, 0.0075], 'head', 'lips', [0.18, 0, 0]), 0.004)
  add(ellipsoid([0, 0.0188, 0.1002], [lw * 0.9, 0.0058 * lp, 0.009], 'head', 'lips', [-0.15, 0, 0]), 0.006)
  // Ears
  const er = face.ear
  for (const sg of [1, -1]) add(ellipsoid([0.074 * fw * sg, 0.088, -0.012], [0.0095, 0.029 * er, 0.019 * er], 'head', 'ear', [0, 0.35 * sg, 0.12 * sg]), 0.008)
  // Neck stub that tucks into the body neck
  add(capsule([0, -0.09, -0.028], [0, 0.03, -0.02], 0.049 * (face.feminine ? 0.88 : 1), 'neck', 'neck'), 0.03)

  // Carved details
  for (const sg of [1, -1]) {
    f.sub(ellipsoid([0.0315 * sg, 0.1, 0.092], [0.0215 * face.eyeSize, 0.0162 * face.eyeSize, 0.0175], 'head', 'skin'), 0.01)
    f.sub(sphere([0.08 * fw * sg, 0.086, -0.006], 0.0085 * er, 'head', 'ear'), 0.004)
    f.sub(ellipsoid([0.0066 * face.noseW * sg, 0.0508 - (nl - 1) * 0.008, 0.1035], [0.0026, 0.0016, 0.0024], 'head', 'skin'), 0.002)
  }
  f.sub(ellipsoid([0, MOUTH_Y, 0.105], [0.0205, 0.0009, 0.013], 'head', 'mouth'), 0.0012)
  f.sub(ellipsoid([0, MOUTH_Y, 0.088], [0.0175, 0.0065, 0.014], 'head', 'mouth'), 0.004)
  return { field: f, prims }
}

// Smoothstep helper
const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const MORPHS = ['jawOpen', 'mouthWide', 'mouthRound', 'mouthPress', 'smileL', 'smileR', 'frown', 'cheekRaise'] as const
export type MorphName = (typeof MORPHS)[number]

// Displacement of a head-local point (scale 1) for each morph at full weight.
export function morphDelta(name: MorphName, x: number, y: number, z: number, out: V3) {
  out[0] = out[1] = out[2] = 0
  const front = ss(-0.02, 0.04, z)
  const mouthReg = (1 - ss(0.026, 0.045, Math.abs(x))) * (1 - ss(0.012, 0.03, Math.abs(y - MOUTH_Y))) * ss(0.075, 0.095, z)
  switch (name) {
    case 'jawOpen': {
      const below = ss(MOUTH_Y + 0.0015, MOUTH_Y - 0.004, y) * front * ss(-0.085, -0.05, y) * (1 - ss(0.06, 0.08, Math.abs(x)))
      const a = 0.26 * below
      const py = y - 0.062, pz = z + 0.035
      const c = Math.cos(a), sn = Math.sin(a)
      out[1] = py * c - pz * sn - py
      out[2] = py * sn + pz * c - pz
      // Upper lip lifts a little.
      const upper = ss(MOUTH_Y - 0.001, MOUTH_Y + 0.004, y) * mouthReg
      out[1] += 0.0018 * upper
      break
    }
    case 'mouthWide':
      out[0] = x * 0.3 * mouthReg
      out[2] = -0.002 * mouthReg
      break
    case 'mouthRound':
      out[0] = -x * 0.32 * mouthReg
      out[2] = 0.006 * mouthReg
      out[1] = (y - MOUTH_Y) * 0.4 * mouthReg
      break
    case 'mouthPress': {
      const up = ss(MOUTH_Y - 0.002, MOUTH_Y + 0.006, y)
      out[1] = up > 0.5 ? -0.0018 * mouthReg : 0.0022 * mouthReg
      out[2] = -0.0015 * mouthReg
      break
    }
    case 'smileL':
    case 'smileR': {
      const sg = name === 'smileL' ? 1 : -1
      const cx = 0.023 * sg
      const dc = Math.hypot(x - cx, (y - MOUTH_Y) * 1.2, (z - 0.097) * 0.6)
      const w = (1 - ss(0.004, 0.024, dc)) * (sg * x > -0.004 ? 1 : 0)
      out[0] = 0.0055 * sg * w
      out[1] = 0.0095 * w
      out[2] = -0.005 * w
      const dk = Math.hypot(x - 0.036 * sg, y - 0.062, z - 0.088)
      const wk = (1 - ss(0.008, 0.03, dk)) * (sg * x > 0 ? 1 : 0)
      out[1] += 0.0032 * wk
      out[2] += 0.0022 * wk
      break
    }
    case 'frown': {
      for (const sg of [1, -1]) {
        const dc = Math.hypot(x - 0.023 * sg, (y - MOUTH_Y) * 1.2, (z - 0.097) * 0.6)
        const w = 1 - ss(0.004, 0.022, dc)
        out[1] -= 0.0065 * w
        out[2] -= 0.0012 * w
      }
      break
    }
    case 'cheekRaise':
      for (const sg of [1, -1]) {
        const dk = Math.hypot(x - 0.038 * sg, y - 0.068, z - 0.085)
        const wk = 1 - ss(0.006, 0.028, dk)
        out[1] += 0.0028 * wk
        out[2] += 0.0018 * wk
      }
      break
  }
}

export type HairStyleKey = 'ponytail' | 'curlyShort' | 'wavyShoulder' | 'slicked' | 'greyBalding' | 'short' | 'bun' | 'none'

// Hair volume: dilated scalp intersected with the style's region, plus style volumes and strands.
export function hairField(style: HairStyleKey, face: FaceShape, head: Field): FieldLike & { extra: Field } {
  const extra = new Field()
  let thick = 0.008
  const hl = face.hairline
  const fw = face.faceW
  let region: (x: number, y: number, z: number) => number
  // Scalp region below which hair does not grow (sides above ears, nape at the back).
  const scalp = (x: number, y: number, z: number, front: number, side: number, nape: number) => {
    const ax = Math.abs(x)
    // Front hairline rises toward the temples when receding.
    const frontLine = front + face.temples * ss(0.008, 0.04, ax) * 0.03 - 0.012 * ss(0.03, 0.065, ax)
    const zf = ss(0.02, 0.07, z)
    const sideLine = side + 0.04 * ss(0.0, 0.08, z)
    const backLine = nape
    const zb = ss(-0.02, -0.08, z)
    const line = frontLine * zf + sideLine * (1 - zf) * (1 - zb) + backLine * zb
    // Ears stay clear
    const ear = 0.02 - Math.hypot(ax - 0.075, y - 0.088, z + 0.012)
    return Math.max(line - y, ear)
  }
  let displace: ((x: number, y: number, z: number) => number) | null = null
  switch (style) {
    case 'slicked':
      thick = 0.0095
      region = (x, y, z) => scalp(x, y, z, hl, 0.088, 0.022)
      displace = (x, y, z) => 0.0004 * Math.sin(x * 520 + Math.sin(z * 40) * 2) + 0.0002 * Math.sin(y * 90)
      break
    case 'greyBalding':
      thick = 0.007
      region = (x, y, z) => Math.max(scalp(x, y, z, 0.2, 0.085, 0.02), y - 0.15 - 0.03 * ss(-0.02, -0.1, z), z - 0.045)
      displace = (x, y) => 0.0009 * Math.sin(y * 380 + x * 60)
      break
    case 'curlyShort':
      thick = 0.013
      region = (x, y, z) => scalp(x, y, z, hl, 0.09, 0.03)
      displace = (x, y, z) => 0.0026 * (Math.sin(x * 230) * Math.sin(y * 225 + 1.3) * Math.sin(z * 220 + 0.7)) - 0.0008
      break
    case 'ponytail':
      thick = 0.0065
      region = (x, y, z) => scalp(x, y, z, hl, 0.088, 0.03)
      displace = (x, y, z) => 0.0005 * Math.sin(x * 420 + y * 30) + 0.0003 * Math.sin(z * 200)
      // Tie at the back, tail added as a separate swinging mesh.
      extra.add(sphere([0, 0.155, -0.098], 0.019, 'head', 'hair'), 0.012)
      break
    case 'bun':
      thick = 0.007
      region = (x, y, z) => scalp(x, y, z, hl, 0.088, 0.03)
      displace = (x, y) => 0.0008 * Math.sin(x * 480 + y * 30)
      extra.add(sphere([0, 0.17, -0.09], 0.036, 'head', 'hair'), 0.015)
      break
    case 'wavyShoulder':
      thick = 0.011
      region = (x, y, z) => scalp(x, y, z, hl, 0.07, -0.25)
      displace = (x, y, z) => 0.0009 * Math.sin(y * 80 + Math.sin(x * 45) * 2.2) + 0.00025 * Math.sin(Math.atan2(x, z) * 90) - 0.0015 * Math.exp(-Math.pow((x - 0.018) / 0.0035, 2)) * (y > 0.12 ? 1 : 0)
      // Long hair falling behind the shoulders and framing the face.
      extra.add(ellipsoid([0, -0.04, -0.06], [0.095 * fw, 0.13, 0.06], 'head', 'hair'), 0.04)
      for (const sg of [1, -1]) extra.add(ellipsoid([0.072 * fw * sg, 0.0, 0.0], [0.03, 0.11, 0.05], 'head', 'hair', [0.15, 0, -0.08 * sg]), 0.04)
      break
    case 'none':
      thick = 0
      region = () => 1
      break
    default:
      thick = 0.0075
      region = (x, y, z) => scalp(x, y, z, hl, 0.088, 0.03)
      displace = (x, _y, z) => 0.0009 * Math.sin(x * 420 + z * 50)
  }
  const extraBounds = extra.ops.length ? extra.bounds(0.02) : null
  // Keep the face clear of the long-hair volumes.
  const faceClear = (x: number, y: number, z: number) => {
    const ax = Math.abs(x)
    return Math.max(ax - 0.058 * fw, -(z - 0.02), y - 0.135, -(y + 0.06))
  }
  return {
    extra,
    bounds(pad: number) {
      const hb = head.bounds(pad + thick)
      if (!extraBounds) return hb
      return {
        min: [Math.min(hb.min[0], extraBounds.min[0]), Math.min(hb.min[1], extraBounds.min[1]), Math.min(hb.min[2], extraBounds.min[2])] as V3,
        max: [Math.max(hb.max[0], extraBounds.max[0]), Math.max(hb.max[1], extraBounds.max[1]), Math.max(hb.max[2], extraBounds.max[2])] as V3,
      }
    },
    eval(x: number, y: number, z: number) {
      if (thick === 0) return 1
      // Only the cranium matters for the cap (ignores nose and lips).
      const skull = head.ops[0].prim.d(x, y, z)
      const reg = region(x, y, z)
      // Thin out toward the hairline so the edge reads as hair, not a helmet.
      const t = thick * (0.35 + 0.65 * Math.min(1, Math.max(0, -reg / 0.03)))
      let d = smax(skull - t, reg, 0.004)
      if (extra.ops.length) {
        let e = extra.eval(x, y, z)
        if (style === 'wavyShoulder') e = smax(e, -faceClear(x, y, z), 0.01)
        d = smin(d, e, 0.012)
      }
      if (displace) d += displace(x, y, z)
      return d
    },
  }
}

// Trimmed beard shell: dilated face intersected with the beard region.
export function beardField(head: Field, thickness: number, style: 'full' | 'stubble'): FieldLike {
  const region = (x: number, y: number, z: number) => {
    const ax = Math.abs(x)
    // Cheek line from the mustache down to the jaw angle, then up the sideburn.
    const top = (ax < 0.026 ? 0.0465 : 0.0465 - (ax - 0.026) * 0.42) + 0.055 * ss(0.062, 0.072, ax) * ss(0.045, 0.01, z)
    // Keep the lips clear: positive inside an ellipse around the mouth.
    // Above the mouth the hole hugs the upper lip so the mustache sits right on it.
    const ry = y > MOUTH_Y ? 0.0098 : 0.0112
    const lipHole = (1 - Math.hypot(x / 0.0245, (y - MOUTH_Y) / ry)) * 0.008
    const shave = style === 'stubble' ? 0.002 : 0
    return Math.max(y - top, -(y + 0.056), -(z + 0.004), lipHole, ax - 0.074) + shave
  }
  const b = head.bounds(0.01)
  return {
    bounds: () => ({ min: [b.min[0], b.min[1], -0.05] as V3, max: [b.max[0], 0.11, b.max[2]] as V3 }),
    eval(x: number, y: number, z: number) {
      const dh = head.eval(x, y, z)
      let d = smax(dh - thickness, region(x, y, z), 0.003)
      d += 0.00012 * Math.sin(x * 1600 + y * 400)
      return d
    },
  }
}

// Eyebrow: tapered strip hugging the brow ridge (head-local, one side).
export function browField(head: Field, sg: number, thick: number, feminine: boolean): FieldLike {
  const pts: V3[] = []
  const xs = [0.009, 0.02, 0.034, 0.048, 0.057]
  const ys = [0.121, 0.1245, 0.1262, 0.1248, 0.1205]
  for (let i = 0; i < xs.length; i++) {
    let z = 0.15
    while (z > 0 && head.eval(xs[i] * sg, ys[i], z) > 0) z -= 0.0005
    pts.push([xs[i] * sg, ys[i], z])
  }
  const r = (feminine ? [0.0028, 0.0029, 0.0025, 0.0018, 0.0009] : [0.0038, 0.0037, 0.0032, 0.0023, 0.0012]).map((v) => v * thick)
  const f = new Field()
  for (let i = 0; i < pts.length - 1; i++) f.add(roundCone(pts[i], pts[i + 1], r[i], r[i + 1], 'head', 'brow'), 0.002)
  const b = f.bounds(0.004)
  return {
    bounds: () => b,
    eval(x: number, y: number, z: number) {
      // Flatten against the skin: only the part just above the surface remains.
      const dh = head.eval(x, y, z)
      let d = smax(f.eval(x, y, z), dh - 0.0016 * thick, 0.0008)
      d += 0.00006 * Math.sin(x * 2600 * sg + y * 900)
      return d
    },
  }
}
