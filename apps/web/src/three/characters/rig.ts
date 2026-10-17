import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { assemble, bakeAO, memo, skinWeights } from './build'
import { bodyField, labCoatField } from './body'
import { handField } from './hand'
import { DEFAULT_FACE, EYE, EYE_R, MORPHS, MOUTH_Y, beardField, browField, hairField, headField, morphDelta, type FaceShape } from './head'
import type { Look } from './looks'
import { bodyMaterials, eyeMaterial, hairMaterial, MAT_CLOTH, MAT_SKIN, plain } from './materials'
import { polygonize, type RawMesh } from './mesher'
import { paintBody, paintHand, paintHead, type Paint } from './paint'
import { Field, roundCone, type V3 } from './sdf'
import { TAG_CODE, clothMaterials } from './clothShader'
import { buildSkeleton, computeJoints, type BoneMap, type Joints, type Shape, type Side } from './skeleton'

export type Lod = 'hero' | 'crowd'

export type Face = {
  head: THREE.Mesh
  beard: THREE.Mesh | null
  eyes: [THREE.Group, THREE.Group]
  lidU: [THREE.Group, THREE.Group]
  lidL: [THREE.Group, THREE.Group]
  brows: [THREE.Group, THREE.Group]
  jaw: THREE.Group
}

export type Rig = {
  root: THREE.Group
  bones: BoneMap
  skeleton: THREE.Skeleton
  joints: Joints
  bindPos: Record<string, THREE.Vector3>
  look: Look
  shape: Shape
  face: Face
  props: { stamp: THREE.Object3D; paper: THREE.Object3D; laptop: THREE.Object3D }
  tail: THREE.Group | null
  meshCount: number
  triangles: number
}

const RES = {
  hero: { body: 0.0125, head: 0.0039, hair: 0.0048, hand: 0.0031, beard: 0.0028, brow: 0.0011 },
  crowd: { body: 0.019, head: 0.006, hair: 0.0075, hand: 0.0052, beard: 0.005, brow: 0.0022 },
}

const shapeOf = (look: Look): Shape => ({ height: look.height, girth: look.girth, shoulders: look.shoulders, feminine: look.feminine, hunch: look.hunch })
const faceOf = (look: Look): FaceShape => ({ ...DEFAULT_FACE, feminine: look.feminine, ...look.face })

const WHITE = new THREE.Color(1, 1, 1)
const rawCache = new Map<string, unknown>()

// Averages the paint around a vertex so color boundaries are smooth instead of stair-stepped.
function soften(at: (x: number, y: number) => Paint, x: number, y: number, r: number): Paint {
  const c = at(x, y)
  const col = c.color.clone()
  for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) col.add(at(x + dx, y + dy).color)
  return { color: col.multiplyScalar(0.2), mat: c.mat }
}
const geoCache = new Map<string, THREE.BufferGeometry>()

const BONE_ORDER = (() => {
  const j = computeJoints({ height: 1, girth: 1, shoulders: 1, feminine: false, hunch: 0 })
  return buildSkeleton(j).list.map((b) => b.name)
})()
const boneIndex = (name: string) => {
  const i = BONE_ORDER.indexOf(name)
  if (i < 0) throw new Error(`Unknown bone ${name}`)
  return i
}

type BodyRaw = { raw: RawMesh; skinIndex: Uint16Array; skinWeight: Float32Array; tags: string[]; ao: Float32Array }

function bodyRaw(shape: Shape, lod: Lod): BodyRaw {
  const key = `body|${shape.height}|${shape.girth}|${shape.shoulders}|${shape.feminine}|${lod}`
  return memo(rawCache as Map<string, BodyRaw>, key, () => {
    const j = computeJoints(shape)
    const { field, torso, arms, legs } = bodyField(j, shape)
    const raw = polygonize(field, RES[lod].body * shape.height)
    const sw = skinWeights(raw, [...torso, ...arms, ...legs], boneIndex, 0.011 * shape.height)
    const ao = bakeAO(field, raw, shape.height)
    return { raw, ...sw, ao }
  })
}

function bodyGeometry(look: Look, lod: Lod): THREE.BufferGeometry {
  const shape = shapeOf(look)
  const key = `bodygeo|${JSON.stringify(look)}|${lod}`
  return memo(geoCache, key, () => {
    const b = bodyRaw(shape, lod)
    const j = computeJoints(shape)
    const s = j.scale
    const n = b.raw.positions.length / 3
    const paints: Paint[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const x = b.raw.positions[i * 3] / s, y = b.raw.positions[i * 3 + 1] / s, z = b.raw.positions[i * 3 + 2] / s
      const side: Side = x >= 0 ? 'L' : 'R'
      const w = j.wrist[side], sh = j.shoulder[side]
      const tag = b.tags[i]
      // Color comes from the per-pixel clothing shader; the CPU paint only picks the material class.
      const mat = paintBody(look, tag, x, y, z, Math.hypot(x - w[0] / s, y - w[1] / s, z - w[2] / s), Math.hypot(x - sh[0] / s, y - sh[1] / s, z - sh[2] / s)).mat
      paints[i] = { color: WHITE, mat }
    }
    const geo = assemble(b.raw, paints, b.ao, { skin: b, noise: 0.02 })
    const bind = new Float32Array(n * 3)
    const tagArr = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      bind[i * 3] = b.raw.positions[i * 3] / s
      bind[i * 3 + 1] = b.raw.positions[i * 3 + 1] / s
      bind[i * 3 + 2] = b.raw.positions[i * 3 + 2] / s
      tagArr[i] = TAG_CODE[b.tags[i]] ?? 7
    }
    geo.setAttribute('aBind', new THREE.BufferAttribute(bind, 3))
    geo.setAttribute('aTag', new THREE.BufferAttribute(tagArr, 1))
    return geo
  })
}

function coatGeometry(look: Look, lod: Lod): THREE.BufferGeometry {
  const shape = shapeOf(look)
  const key = `coat|${shape.height}|${shape.girth}|${lod}`
  return memo(geoCache, key, () => {
    const j = computeJoints(shape)
    const field = labCoatField(j, shape)
    const raw = polygonize(field, Math.min(RES[lod].body * 0.85, 0.0105) * shape.height)
    const prims = field.ops.map((o) => o.prim)
    // Skirt follows the hips with a share of the thigh on each side.
    const sw = skinWeights(raw, prims, boneIndex, 0.014 * shape.height)
    const n = raw.positions.length / 3
    for (let i = 0; i < n; i++) {
      const y = raw.positions[i * 3 + 1] / j.scale
      if (sw.tags[i] !== 'skirt' || y > 0.92) continue
      const x = raw.positions[i * 3]
      const t = Math.min(0.55, (0.92 - y) * 1.2)
      sw.skinIndex[i * 4] = boneIndex('hips')
      sw.skinWeight[i * 4] = 1 - t
      sw.skinIndex[i * 4 + 1] = boneIndex(x >= 0 ? 'thigh_L' : 'thigh_R')
      sw.skinWeight[i * 4 + 1] = t
      sw.skinWeight[i * 4 + 2] = sw.skinWeight[i * 4 + 3] = 0
    }
    const ao = bakeAO(field, raw, j.scale, 0.35)
    const white = new THREE.Color('#f1efe9')
    const paints: Paint[] = sw.tags.map(() => ({ color: white, mat: MAT_CLOTH }))
    return assemble(raw, paints, ao, { skin: sw })
  })
}

type HandRaw = { raw: RawMesh; tags: string[]; bones: string[][]; weights: Float32Array; tipDist: Float32Array; ao: Float32Array }

function handRaw(feminine: boolean, lod: Lod): HandRaw {
  return memo(rawCache as Map<string, HandRaw>, `hand|${feminine}|${lod}`, () => {
    const j = computeJoints({ height: 1, girth: 1, shoulders: 1, feminine, hunch: 0 })
    const { field, prims } = handField(j.fingerJoints, feminine)
    const raw = polygonize(field, RES[lod].hand)
    const names = [...new Set(prims.map((p) => p.bone))]
    const sw = skinWeights(raw, prims, (b) => names.indexOf(b), 0.0035)
    const n = raw.positions.length / 3
    const bones: string[][] = []
    const tipDist = new Float32Array(n)
    const tips = Object.values(j.fingerJoints).map((pts) => pts[3])
    for (let i = 0; i < n; i++) {
      bones.push([0, 1, 2, 3].map((k) => names[sw.skinIndex[i * 4 + k]]))
      const x = raw.positions[i * 3], y = raw.positions[i * 3 + 1], z = raw.positions[i * 3 + 2]
      tipDist[i] = Math.min(...tips.map((t) => Math.hypot(x - t[0], y - t[1], z - t[2])))
    }
    const ao = bakeAO(field, raw, 0.55, 0.45)
    return { raw, tags: sw.tags, bones, weights: sw.skinWeight, tipDist, ao }
  })
}

function handGeometry(look: Look, side: Side, j: Joints, lod: Lod): THREE.BufferGeometry {
  const key = `hand|${side}|${look.skin}|${look.feminine}|${j.scale}|${lod}`
  return memo(geoCache, key, () => {
    const h = handRaw(look.feminine, lod)
    const n = h.raw.positions.length / 3
    const skinIndex = new Uint16Array(n * 4)
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) skinIndex[i * 4 + k] = boneIndex(`${h.bones[i][k]}_${side}`)
    const paints = h.tags.map((t, i) => paintHand(look, t, h.raw.positions[i * 3], h.raw.positions[i * 3 + 1], h.tipDist[i]))
    return assemble(h.raw, paints, h.ao, { transform: j.handMatrix[side], flip: side === 'R', skin: { skinIndex, skinWeight: h.weights }, noise: 0.02 })
  })
}

type HeadRaw = { raw: RawMesh; tags: string[]; ao: Float32Array; field: Field; morphs: Float32Array[] }

function headRaw(face: FaceShape, lod: Lod): HeadRaw {
  return memo(rawCache as Map<string, HeadRaw>, `head|${JSON.stringify(face)}|${lod}`, () => {
    const { field, prims } = headField(face)
    const raw = polygonize(field, RES[lod].head)
    const sw = skinWeights(raw, prims, () => 0, 0.004)
    const ao = bakeAO(field, raw, 0.45, 0.5)
    const morphs = computeMorphs(raw.positions)
    return { raw, tags: sw.tags, ao, field, morphs }
  })
}

function computeMorphs(positions: Float32Array): Float32Array[] {
  const n = positions.length / 3
  const out: V3 = [0, 0, 0]
  return MORPHS.map((name) => {
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      morphDelta(name, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], out)
      arr[i * 3] = out[0]
      arr[i * 3 + 1] = out[1]
      arr[i * 3 + 2] = out[2]
    }
    return arr
  })
}

function withMorphs(geo: THREE.BufferGeometry, morphs: Float32Array[], s: number) {
  geo.morphAttributes.position = morphs.map((m) => {
    const a = new Float32Array(m.length)
    for (let i = 0; i < m.length; i++) a[i] = m[i] * s
    return new THREE.BufferAttribute(a, 3)
  })
  geo.morphTargetsRelative = true
  return geo
}

function headGeometry(look: Look, s: number, lod: Lod): THREE.BufferGeometry {
  const face = faceOf(look)
  const key = `head|${JSON.stringify(face)}|${look.skin}|${look.lipTint}|${look.accessories.join()}|${look.beardColor}|${s}|${lod}`
  return memo(geoCache, key, () => {
    const h = headRaw(face, lod)
    const paints = h.tags.map((t, i) => {
      const z = h.raw.positions[i * 3 + 2]
      return soften((px, py) => paintHead(look, t, px, py, z), h.raw.positions[i * 3], h.raw.positions[i * 3 + 1], RES[lod].head * 0.45)
    })
    const geo = assemble(h.raw, paints, h.ao, { transform: new THREE.Matrix4().makeScale(s, s, s), noise: 0.025 })
    return withMorphs(geo, h.morphs, s)
  })
}

function hairGeometry(look: Look, s: number, lod: Lod): THREE.BufferGeometry | null {
  if (look.hairStyle === 'none') return null
  const face = faceOf(look)
  const key = `hair|${look.hairStyle}|${JSON.stringify(face)}|${s}|${lod}`
  return memo(geoCache, key, () => {
    const h = headRaw(face, lod)
    const hf = hairField(look.hairStyle, face, h.field)
    const raw = polygonize(hf, RES[lod].hair, 0.006)
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(raw.positions)
    for (let i = 0; i < pos.length; i++) pos[i] *= s
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(raw.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(raw.indices, 1))
    geo.computeBoundingSphere()
    return geo
  })
}

const beardMat = new Map<string, THREE.Material>()
function beardGeometry(look: Look, s: number, lod: Lod): THREE.BufferGeometry | null {
  if (!look.accessories.includes('beard')) return null
  const face = faceOf(look)
  const key = `beard|${JSON.stringify(face)}|${look.beardColor}|${look.beardGrey}|${s}|${lod}`
  return memo(geoCache, key, () => {
    const h = headRaw(face, lod)
    const bf = beardField(h.field, 0.0026, 'full')
    const raw = polygonize(bf, RES[lod].beard, 0.004)
    const base = new THREE.Color(look.beardColor ?? '#1a120e')
    const grey = new THREE.Color('#8f8a84')
    const n = raw.positions.length / 3
    const paints: Paint[] = []
    for (let i = 0; i < n; i++) {
      const x = raw.positions[i * 3], y = raw.positions[i * 3 + 1]
      const chin = Math.max(0, 1 - Math.hypot(x / 0.03, (y + 0.02) / 0.03))
      const fleck = 0.5 + 0.5 * Math.sin(x * 2100) * Math.sin(y * 1700)
      paints.push({ color: base.clone().lerp(grey, (look.beardGrey ?? 0) * chin * (0.55 + 0.45 * fleck)), mat: MAT_SKIN })
    }
    const geo = assemble(raw, paints, bakeAO(bf, raw, 0.4, 0.4), { transform: new THREE.Matrix4().makeScale(s, s, s), noise: 0.12 })
    const morphs = computeMorphs(raw.positions)
    return withMorphs(geo, morphs, s)
  })
}

function beardMaterial(): THREE.Material {
  return memo(beardMat, 'beard', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.75, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#5a524c') }))
}

function tailGeometry(s: number, lod: Lod): THREE.BufferGeometry {
  return memo(geoCache, `tail|${s}|${lod}`, () => {
    const f = new Field()
    const pts: V3[] = [[0, 0, 0], [0, -0.04, -0.045], [0, -0.12, -0.06], [0, -0.21, -0.05], [0, -0.27, -0.03]]
    const r = [0.018, 0.026, 0.024, 0.016, 0.006]
    for (let i = 0; i < pts.length - 1; i++) f.add(roundCone(pts[i], pts[i + 1], r[i], r[i + 1], 'head', 'hair'), 0.02)
    f.displace = (x, y, z, d) => d + 0.0012 * Math.sin(Math.atan2(x, z + 0.05) * 18 + y * 30)
    const raw = polygonize(f, RES[lod].hair)
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(raw.positions)
    for (let i = 0; i < pos.length; i++) pos[i] *= s
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(raw.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(raw.indices, 1))
    return geo
  })
}

// Projects a point forward (+z) onto the face surface.
function onFace(field: Field, x: number, y: number, lift: number): V3 {
  let z = 0.16
  while (z > 0 && field.eval(x, y, z) > 0) z -= 0.0008
  return [x, y, z + lift]
}

function browGeometry(face: FaceShape, field: Field, side: Side, thick: number, s: number, lod: Lod): THREE.BufferGeometry {
  return memo(geoCache, `brow|${JSON.stringify(face)}|${side}|${thick}|${s}|${lod}`, () => {
    const sg = side === 'L' ? 1 : -1
    const bf = browField(field, sg, thick, face.feminine)
    const raw = polygonize(bf, RES[lod].brow, 0.002)
    const pos = new Float32Array(raw.positions)
    // Pivot at the outer end so a rotation lifts the inner end.
    const outer = onFace(field, 0.056 * sg, 0.12, 0.0014)
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (pos[i] - outer[0]) * s
      pos[i + 1] = (pos[i + 1] - outer[1]) * s
      pos[i + 2] = (pos[i + 2] - outer[2]) * s
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(raw.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(raw.indices, 1))
    geo.userData.pivot = outer
    return geo
  })
}

const skinMats = new Map<string, THREE.Material>()
const skinTone = (hex: string, mul = 1) =>
  memo(skinMats, `${hex}|${mul}`, () => {
    const c = new THREE.Color(hex).multiplyScalar(mul)
    return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ff9b7d'), sheenRoughness: 0.5 })
  })
const clothMats = new Map<string, THREE.Material>()
const clothMat = (hex: string) =>
  memo(clothMats, hex, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color('#6d6d6d') }))

const sharedGeo = new Map<string, THREE.BufferGeometry>()
const g = <T extends THREE.BufferGeometry>(key: string, make: () => T) => memo(sharedGeo, key, make) as T

export function buildRig(look: Look, castShadow = true, lod: Lod = 'hero'): Rig {
  const shape = shapeOf(look)
  const face = faceOf(look)
  const j = computeJoints(shape)
  const s = j.scale
  const { root: hips, bones, list, bindPos } = buildSkeleton(j)
  const root = new THREE.Group()
  root.add(hips)
  root.updateMatrixWorld(true)
  const skeleton = new THREE.Skeleton(list)
  let meshCount = 0
  let triangles = 0
  const track = (m: THREE.Mesh) => {
    meshCount++
    const geo = m.geometry
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3
    m.castShadow = castShadow
    m.receiveShadow = true
    return m
  }
  const skinned = (geo: THREE.BufferGeometry, mats: THREE.Material | THREE.Material[]) => {
    const m = new THREE.SkinnedMesh(geo, mats)
    m.bind(skeleton, new THREE.Matrix4())
    m.frustumCulled = false
    root.add(m)
    return track(m)
  }
  // Child of a bone, placed from bind-pose root coordinates.
  const attach = (bone: string, obj: THREE.Object3D, at: V3 | THREE.Vector3) => {
    const p = at instanceof THREE.Vector3 ? at : new THREE.Vector3(at[0], at[1], at[2])
    obj.position.add(p.clone().sub(bindPos[bone]))
    bones[bone].add(obj)
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) track(o as THREE.Mesh)
    })
    return obj
  }
  const mats = bodyMaterials()

  // Body, hands, coat
  skinned(bodyGeometry(look, lod), clothMaterials(mats, look, j))
  for (const side of ['L', 'R'] as Side[]) skinned(handGeometry(look, side, j, lod), mats)
  if (look.accessories.includes('labCoat')) skinned(coatGeometry(look, lod), mats)

  // Head (rigid on the head bone) with mouth morphs
  const headBone = bones.head
  const headMesh = new THREE.Mesh(headGeometry(look, s, lod), mats)
  headMesh.updateMorphTargets()
  headBone.add(headMesh)
  track(headMesh)
  const hg = hairGeometry(look, s, lod)
  if (hg && !look.accessories.includes('helmet')) {
    const hair = new THREE.Mesh(hg, hairMaterial(look.hair))
    headBone.add(hair)
    track(hair)
  } else if (hg) {
    const hair = new THREE.Mesh(hg, hairMaterial(look.hair))
    hair.scale.setScalar(0.98)
    headBone.add(hair)
    track(hair)
  }
  const bg = beardGeometry(look, s, lod)
  let beard: THREE.Mesh | null = null
  if (bg) {
    beard = new THREE.Mesh(bg, beardMaterial())
    beard.updateMorphTargets()
    headBone.add(beard)
    track(beard)
  }

  // Eyes, lids with lashes, brows
  const er = EYE_R * s * (face.eyeSize ?? 1)
  const eyeGeo = g(`eye|${er}`, () => new THREE.SphereGeometry(er, 32, 24).rotateX(Math.PI / 2))
  const lidU = g(`lidU|${er}`, () => new THREE.SphereGeometry(er * 1.08, 32, 10, 0, Math.PI * 2, 0, 1.45))
  const lidL = g(`lidL|${er}`, () => new THREE.SphereGeometry(er * 1.06, 32, 8, 0, Math.PI * 2, Math.PI - 1.12, 1.12))
  const lashGeo = g(`lash|${er}|${look.feminine}`, () => new THREE.TorusGeometry(er * 1.08 * Math.sin(1.45), (look.feminine ? 0.0014 : 0.001) * s, 5, 32, Math.PI))
  const eyes: THREE.Group[] = []
  const lidsU: THREE.Group[] = []
  const lidsL: THREE.Group[] = []
  const brows: THREE.Group[] = []
  const lidMat = skinTone(look.skin, 0.94)
  const hr = headRaw(face, lod)
  for (const side of ['L', 'R'] as Side[]) {
    const sg = side === 'L' ? 1 : -1
    const c = new THREE.Vector3(EYE[0] * sg * s, EYE[1] * s, EYE[2] * s)
    const eye = new THREE.Group()
    eye.position.copy(c)
    eye.add(new THREE.Mesh(eyeGeo, eyeMaterial(look.eyes)))
    headBone.add(eye)
    track(eye.children[0] as THREE.Mesh)
    eyes.push(eye)
    const up = new THREE.Group()
    up.position.copy(c)
    up.add(new THREE.Mesh(lidU, lidMat))
    const lash = new THREE.Mesh(lashGeo, plain('#0a0706', 0.7))
    lash.rotation.x = Math.PI / 2
    lash.position.y = er * 1.08 * Math.cos(1.45)
    up.add(lash)
    headBone.add(up)
    up.children.forEach((m) => track(m as THREE.Mesh))
    lidsU.push(up)
    const lo = new THREE.Group()
    lo.position.copy(c)
    lo.add(new THREE.Mesh(lidL, lidMat))
    headBone.add(lo)
    track(lo.children[0] as THREE.Mesh)
    lidsL.push(lo)
    const browGeo = browGeometry(face, hr.field, side, look.browThick ?? 1, s, lod)
    const brow = new THREE.Group()
    const pv = browGeo.userData.pivot as V3
    brow.position.set(pv[0] * s, pv[1] * s, pv[2] * s)
    brow.add(new THREE.Mesh(browGeo, hairMaterial(look.brows ?? look.hair)))
    brow.userData.rest = brow.position.clone()
    headBone.add(brow)
    track(brow.children[0] as THREE.Mesh)
    brows.push(brow)
  }

  // Teeth and tongue; the lower set rides on the jaw pivot.
  const teethMat = plain('#ece6da', 0.32)
  const toothGeo = g(`teeth|${s}`, () => new THREE.TorusGeometry(0.0205 * s, 0.0036 * s, 6, 18, Math.PI))
  const upper = new THREE.Mesh(toothGeo, teethMat)
  upper.rotation.x = Math.PI / 2
  upper.scale.set(1, 1, 1.25)
  upper.position.set(0, (MOUTH_Y + 0.0068) * s, 0.0695 * s)
  headBone.add(upper)
  track(upper)
  const jaw = new THREE.Group()
  jaw.position.set(0, 0.062 * s, -0.035 * s)
  headBone.add(jaw)
  const lower = new THREE.Mesh(toothGeo, teethMat)
  lower.rotation.x = Math.PI / 2
  lower.scale.set(0.95, 1, 1.15)
  lower.position.set(0, (MOUTH_Y - 0.0075 - 0.062) * s, (0.068 + 0.035) * s)
  jaw.add(lower)
  track(lower)
  const tongue = new THREE.Mesh(g('tongue', () => new THREE.SphereGeometry(1, 16, 10)), plain('#9a4646', 0.45))
  tongue.scale.set(0.016 * s, 0.006 * s, 0.02 * s)
  tongue.position.set(0, (MOUTH_Y - 0.009 - 0.062) * s, (0.075 + 0.035) * s)
  jaw.add(tongue)
  track(tongue)

  // Ponytail on a swinging pivot
  let tail: THREE.Group | null = null
  if (look.hairStyle === 'ponytail') {
    tail = new THREE.Group()
    tail.position.set(0, 0.152 * s, -0.112 * s)
    tail.add(new THREE.Mesh(tailGeometry(s, lod), hairMaterial(look.hair)))
    headBone.add(tail)
    track(tail.children[0] as THREE.Mesh)
  }

  addAccessories(look, j, attach, s)
  const props = addProps(look, j, bones, bindPos, root, track, s)

  return {
    root,
    bones,
    skeleton,
    joints: j,
    bindPos,
    look,
    shape,
    face: { head: headMesh, beard, eyes: eyes as [THREE.Group, THREE.Group], lidU: lidsU as [THREE.Group, THREE.Group], lidL: lidsL as [THREE.Group, THREE.Group], brows: brows as [THREE.Group, THREE.Group], jaw },
    props,
    tail,
    meshCount,
    triangles: Math.round(triangles),
  }
}

type Attach = (bone: string, obj: THREE.Object3D, at: V3 | THREE.Vector3) => THREE.Object3D

function addAccessories(look: Look, j: Joints, attach: Attach, s: number) {
  const has = (a: Look['accessories'][number]) => look.accessories.includes(a)
  const v = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s]
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(geo, mat)
  if (has('backpack')) {
    const grp = new THREE.Group()
    grp.add(mesh(g(`pack|${s}`, () => new RoundedBoxGeometry(0.27 * s, 0.37 * s, 0.13 * s, 4, 0.045 * s)), clothMat('#2b2d35')))
    const pocket = mesh(g(`pocket|${s}`, () => new RoundedBoxGeometry(0.2 * s, 0.13 * s, 0.05 * s, 3, 0.02 * s)), clothMat('#24262d'))
    pocket.position.set(0, -0.08 * s, -0.07 * s)
    grp.add(pocket)
    attach('chest', grp, v(0, 1.21, -0.185))
  }
  if (has('hood')) {
    const hood = mesh(g(`hood|${s}`, () => new THREE.TorusGeometry(0.083 * s, 0.034 * s, 12, 28)), clothMat(new THREE.Color(look.top).multiplyScalar(0.88).getHexString().padStart(7, '#')))
    hood.rotation.x = Math.PI / 2 + 0.35
    hood.scale.set(1.15, 1, 0.9)
    attach('chest', hood, v(0, 1.445, -0.06))
  }
  if (has('headset')) {
    const grp = new THREE.Group()
    const band = mesh(g(`hsband|${s}`, () => new THREE.TorusGeometry(0.074 * s, 0.0075 * s, 8, 28, Math.PI)), plain('#1d1d22', 0.4))
    band.rotation.x = -Math.PI / 2
    band.rotation.z = Math.PI
    grp.add(band)
    for (const sg of [1, -1]) {
      const cup = mesh(g(`hscup|${s}`, () => new THREE.CylinderGeometry(0.032 * s, 0.032 * s, 0.022 * s, 20)), plain('#24242a', 0.35))
      cup.rotation.z = Math.PI / 2
      cup.position.set(0.074 * s * sg, -0.01 * s, 0.012 * s)
      grp.add(cup)
      const ring = mesh(g(`hsring|${s}`, () => new THREE.TorusGeometry(0.027 * s, 0.004 * s, 6, 20)), plain(look.accent ?? '#f2b705', 0.4))
      ring.rotation.y = Math.PI / 2
      ring.position.set(0.086 * s * sg, -0.01 * s, 0.012 * s)
      grp.add(ring)
    }
    attach('neck', grp, v(0, 1.46, 0.0))
  }
  if (has('messengerBag')) attach('hips', mesh(g(`mbag|${s}`, () => new RoundedBoxGeometry(0.07 * s, 0.25 * s, 0.31 * s, 3, 0.02 * s)), plain('#4a3426', 0.55)), v(0.21, 0.93, 0.0))
  if (has('folderBag')) attach('hips', mesh(g(`fbag|${s}`, () => new RoundedBoxGeometry(0.05 * s, 0.21 * s, 0.29 * s, 3, 0.012 * s)), plain('#6a4226', 0.42)), v(-0.212, 0.93, 0.015))
  if (has('glasses')) {
    const grp = new THREE.Group()
    const metal = plain('#2a2420', 0.35, 0.5)
    for (const sg of [1, -1]) {
      const ring = mesh(g(`glring|${s}`, () => new THREE.TorusGeometry(0.0158 * s, 0.0013 * s, 6, 28)), metal)
      ring.position.set(0.032 * sg * s, 0.099 * s, 0.112 * s)
      grp.add(ring)
      const arm = mesh(g(`glarm|${s}`, () => new THREE.BoxGeometry(0.0016 * s, 0.0025 * s, 0.11 * s)), metal)
      arm.position.set(0.066 * sg * s, 0.1 * s, 0.058 * s)
      arm.rotation.y = 0.12 * sg
      grp.add(arm)
    }
    const bridge = mesh(g(`glbr|${s}`, () => new THREE.CylinderGeometry(0.0012 * s, 0.0012 * s, 0.018 * s, 6)), metal)
    bridge.rotation.z = Math.PI / 2
    bridge.position.set(0, 0.104 * s, 0.114 * s)
    grp.add(bridge)
    attach('head', grp, new THREE.Vector3(...j.head))
  }
  if (has('helmet')) {
    const helmet = mesh(g(`helmet|${s}`, () => new THREE.SphereGeometry(0.118 * s, 32, 16, 0, Math.PI * 2, 0, 1.62)), plain('#3f4a2a', 0.62))
    helmet.scale.set(1.0, 0.86, 1.05)
    helmet.position.set(0, 0.114 * s, -0.016 * s)
    attach('head', helmet, new THREE.Vector3(...j.head))
  }
  if (has('tacticalVest')) {
    const grp = new THREE.Group()
    for (const x of [-0.075, 0, 0.075]) {
      const p = mesh(g(`pouch|${s}`, () => new RoundedBoxGeometry(0.065 * s, 0.085 * s, 0.04 * s, 3, 0.012 * s)), clothMat('#2d3420'))
      p.position.set(x * s, 0, 0)
      grp.add(p)
    }
    attach('spine', grp, v(0, 1.11, 0.115))
  }
  if (has('lanyard')) {
    const card = mesh(g(`card|${s}`, () => new THREE.BoxGeometry(0.055 * s, 0.08 * s, 0.003 * s)), plain('#f4f2ec', 0.5))
    attach('chest', card, v(0, 1.29, 0.122))
  }
  if (has('stethoscope')) {
    const grp = new THREE.Group()
    const tube = mesh(g(`steth|${s}`, () => new THREE.TorusGeometry(0.085 * s, 0.0042 * s, 6, 32, Math.PI * 1.15)), plain('#2a2d33', 0.4))
    tube.rotation.set(Math.PI / 2 + 0.55, 0, Math.PI * 0.425 + Math.PI)
    grp.add(tube)
    const piece = mesh(g(`stpc|${s}`, () => new THREE.CylinderGeometry(0.017 * s, 0.017 * s, 0.008 * s, 20)), plain('#c9ccd2', 0.25, 0.9))
    piece.rotation.x = Math.PI / 2
    piece.position.set(0.055 * s, -0.12 * s, 0.11 * s)
    grp.add(piece)
    attach('chest', grp, v(0, 1.43, 0.02))
  }
}

function addProps(
  look: Look,
  j: Joints,
  bones: BoneMap,
  bindPos: Record<string, THREE.Vector3>,
  root: THREE.Group,
  track: (m: THREE.Mesh) => THREE.Mesh,
  s: number,
) {
  // Canonical hand placement converted to the right hand bone's local space.
  const inHand = (obj: THREE.Object3D) => {
    const wrap = new THREE.Group()
    wrap.add(obj)
    const m = j.handMatrix.R.clone()
    m.premultiply(new THREE.Matrix4().makeTranslation(-bindPos.hand_R.x, -bindPos.hand_R.y, -bindPos.hand_R.z))
    wrap.applyMatrix4(m)
    wrap.scale.multiplyScalar(1 / s)
    bones.hand_R.add(wrap)
    wrap.visible = false
    obj.traverse((o) => (o as THREE.Mesh).isMesh && track(o as THREE.Mesh))
    return wrap
  }
  const stamp = new THREE.Group()
  const handle = new THREE.Mesh(g(`sthandle|${s}`, () => new THREE.CylinderGeometry(0.011 * s, 0.013 * s, 0.075 * s, 14)), plain('#7a4a26', 0.55))
  handle.rotation.x = Math.PI / 2
  stamp.add(handle)
  const knob = new THREE.Mesh(g(`stknob|${s}`, () => new THREE.SphereGeometry(0.018 * s, 16, 12)), plain('#5a3418', 0.5))
  knob.position.z = 0.042 * s
  stamp.add(knob)
  const pad = new THREE.Mesh(g(`stpad|${s}`, () => new RoundedBoxGeometry(0.055 * s, 0.04 * s, 0.02 * s, 2, 0.004 * s)), plain('#8a1d24', 0.6))
  pad.position.z = -0.045 * s
  stamp.add(pad)
  stamp.position.set(0.052 * s, -0.022 * s, -0.004 * s)
  const paper = new THREE.Group()
  const sheet = new THREE.Mesh(g(`paper|${s}`, () => new THREE.BoxGeometry(0.2 * s, 0.0015 * s, 0.27 * s)), plain('#f4f0e6', 0.8))
  paper.add(sheet)
  const seal = new THREE.Mesh(g(`seal|${s}`, () => new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.002 * s, 18)), plain('#b8202e', 0.5))
  seal.position.set(0.05 * s, 0.001 * s, -0.08 * s)
  paper.add(seal)
  paper.position.set(0.075 * s, -0.004 * s, 0.11 * s)
  // Laptop sits in front of the character (used for typing at a counter).
  const laptop = new THREE.Group()
  const base = new THREE.Mesh(g(`lpbase|${s}`, () => new RoundedBoxGeometry(0.32 * s, 0.018 * s, 0.22 * s, 2, 0.006 * s)), plain('#9aa0a8', 0.35, 0.6))
  laptop.add(base)
  const screen = new THREE.Mesh(g(`lpscreen|${s}`, () => new RoundedBoxGeometry(0.32 * s, 0.21 * s, 0.01 * s, 2, 0.004 * s)), plain('#2a2d33', 0.3, 0.4))
  screen.position.set(0, 0.105 * s, -0.115 * s)
  screen.rotation.x = -0.25
  laptop.add(screen)
  const glow = new THREE.Mesh(g(`lpglow|${s}`, () => new THREE.PlaneGeometry(0.29 * s, 0.18 * s)), new THREE.MeshBasicMaterial({ color: '#9fd0ff' }))
  glow.position.set(0, 0.105 * s, -0.109 * s)
  glow.rotation.x = -0.25
  laptop.add(glow)
  laptop.position.set(0, 1.02 * s, 0.33 * s)
  laptop.visible = false
  root.add(laptop)
  laptop.traverse((o) => (o as THREE.Mesh).isMesh && track(o as THREE.Mesh))
  void look
  return { stamp: inHand(stamp), paper: inHand(paper), laptop }
}

export { MAT_SKIN }
