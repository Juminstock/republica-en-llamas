import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { canopyClusters, clusterGeometry, foliageMaterial, leafTexture, windTime } from './foliage'
import { pbrMaterial } from './pbr'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { useInstances, type Inst } from './instancing'
import { COLLIDERS, MUSEO, PALACIO, PEDESTAL_SIZE, PLAZA, SCULPTURES, type Collider } from './layout'
import { patchRuin, ruinDepthMaterial, rng } from './ruinShader'

type P2 = [number, number]

const PALMS: P2[] = [
  [-39.5, -24], [-39.5, -14], [-39.5, -4], [-39.5, 10], [-39.5, 20], [-39.5, 29],
  [40.5, -26], [40.5, -14], [40.5, -2], [40.5, 10], [40.5, 22],
  [-30, 31], [-14, 31.5], [16, 31.5], [31, 31],
  [-27, -29], [27, -29],
]
const TREES: P2[] = [
  [-26, 4], [31, 6], [-9, -21], [21, -25], [-36, 34], [44, 33], [46, -31], [-41, -30],
  [30, 38], [-18, 38], [54, 12], [54, -16], [52, 40], [-66, -38], [-66, 40], [8, 40],
]

// Trunks are solid; a building worker can merge these into the movement colliders.
export const VEGETATION_COLLIDERS: Collider[] = [
  ...PALMS.map(([x, z]) => ({ kind: 'circle' as const, x, z, r: 0.45 })),
  ...TREES.map(([x, z]) => ({ kind: 'circle' as const, x, z, r: 0.6 })),
]

export const TRUNK_LEAN = 1.1

export function palmTrunk() {
  const g = new THREE.CylinderGeometry(0.17, 0.32, 1, 8, 14, true)
  g.translate(0, 0.5, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setX(i, pos.getX(i) + TRUNK_LEAN * y * y)
  }
  g.computeVertexNormals()
  return g
}

// A drooping, tapered frond. Leaflets come from the alpha texture.
export function frondGeometry() {
  const L = 4.6
  const seg = 12
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const x = t * L
    const y = 0.5 * t - 2.2 * t * t
    const w = 1.1 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)), 0.6)
    pos.push(x, y + w * 0.12, -w, x, y + w * 0.12, w, x, y + 0.08, 0)
    uv.push(t, 0, t, 1, t, 0.5)
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 3
    const b = (i + 1) * 3
    idx.push(a, b, a + 2, a + 2, b, b + 2, a + 2, b + 2, a + 1, a + 1, b + 2, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function frondTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = '#ffffff'
  ctx.lineCap = 'round'
  for (let i = 0; i < 64; i++) {
    const x = 8 + i * 7.9
    for (const dir of [-1, 1]) {
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(x, 64)
      ctx.quadraticCurveTo(x + 18, 64 + dir * 30, x + 30, 64 + dir * 60)
      ctx.stroke()
    }
  }
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(0, 64)
  ctx.lineTo(512, 64)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

export function blobGeometry(seed: number, detail: number) {
  const ico = new THREE.IcosahedronGeometry(1, detail)
  ico.deleteAttribute('uv')
  ico.deleteAttribute('normal')
  const g = mergeVertices(ico)
  ico.dispose()
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 2) * Math.sin(v.z * 3.3 + seed * 3)
    v.multiplyScalar(1 + n * 0.22)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export function bladeGeometry() {
  const pos: number[] = []
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI + 0.3
    const w = 0.05
    const h = 0.45 + (k % 2) * 0.25
    const lean = 0.12 * (k % 2 ? 1 : -1)
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    pos.push(-w * cx, 0, -w * cz, w * cx, 0, w * cz, lean * cz, h, -lean * cx)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function insideBox(x: number, z: number, pad: number) {
  return COLLIDERS.some((c) => c.kind === 'box' && x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad && c.maxX - c.minX < 40)
}

export const Vegetation = memo(function Vegetation() {
  const { tex, uRuin } = useWorld()

  const geo = useMemo(
    () => ({
      trunk: palmTrunk(),
      frond: frondGeometry(),
      blob: clusterGeometry(),
      bush: clusterGeometry(),
      blade: bladeGeometry(),
      treeTrunk: new THREE.CylinderGeometry(0.22, 0.4, 1, 7).translate(0, 0.5, 0),
      ivy: new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
    }),
    [],
  )
  const frondMap = useMemo(frondTexture, [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      frondMap.dispose()
    },
    [geo, frondMap],
  )

  const mat = useMemo(() => {
    const grassDepth = ruinDepthMaterial(uRuin, { appear: 'instance' })
    return {
      trunk: pbrMaterial('bark', { repeat: [1.5, 6], color: '#b9a88e', normal: 1.2 }),
      treeTrunk: pbrMaterial('bark', { repeat: [1.2, 2], color: '#8c7a66', normal: 1.4 }),
      frond: patchRuin(
        new THREE.MeshStandardMaterial({ color: '#4f7a33', alphaMap: frondMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
        uRuin,
        { tint: { color: '#7a6c3a', amount: 0.3 }, grow: 0.12 },
      ),
      canopy: foliageMaterial(uRuin, 0.32),
      grass: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 }), uRuin, { appear: 'instance' }),
      bush: foliageMaterial(uRuin, 0, 'instance'),
      ivy: patchRuin(new THREE.MeshStandardMaterial({ map: tex.ivy, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }), uRuin, { appear: 'instance' }),
      grassDepth,
      ivyDepth: ruinDepthMaterial(uRuin, { appear: 'instance' }),
      leafDepth: (() => {
        const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTexture(), alphaTest: 0.45 })
        return d
      })(),
    }
  }, [tex, uRuin, frondMap])

  const data = useMemo(() => {
    const r = rng(7)
    const trunks: Inst[] = []
    const fronds: Inst[] = []
    for (const [x, z] of PALMS) {
      const h = 9 + r() * 5
      const rot = r() * Math.PI * 2
      trunks.push({ p: [x, 0, z], r: [0, rot, 0], s: [1.1, h, 1.1] })
      const top = new THREE.Vector3(TRUNK_LEAN, h, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
      const n = 15
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.4
        const up = i % 3 === 0 ? 0.35 + r() * 0.3 : (r() - 0.4) * 0.5
        const s = 0.85 + r() * 0.35
        fronds.push({ p: [x + top.x, top.y - 0.1, z + top.z], r: [0, a, up], s })
      }
    }
    const tTrunks: Inst[] = []
    const canopy: Inst[] = []
    for (const [x, z] of TREES) {
      const h = 3.2 + r() * 2.2
      tTrunks.push({ p: [x, 0, z], r: [0, r() * 6, 0], s: [1, h, 1] })
      canopyClusters(x, z, h, 2.6 + r() * 1.2, r, canopy, 40)
    }
    const grass: Inst[] = []
    const green = new THREE.Color()
    const pushGrass = (x: number, z: number, bias: number) => {
      if (insideBox(x, z, 0.4)) return
      green.setHSL(0.16 + r() * 0.09, 0.3 + r() * 0.25, 0.16 + r() * 0.14)
      const s = 0.45 + r() * 0.75
      grass.push({ p: [x, 0, z], r: [0, r() * 6.28, 0], s: [s, s * (0.8 + r() * 0.9), s], c: green.clone(), t: Math.max(0.05, r() * 0.75 - bias) })
    }
    // Weeds take the plaza in clumps, not as a lawn.
    for (let c = 0; c < 46; c++) {
      const cx = PLAZA.minX + r() * (PLAZA.maxX - PLAZA.minX)
      const cz = PLAZA.minZ + r() * (PLAZA.maxZ - PLAZA.minZ)
      const rad = 1.5 + r() * 4
      const n = 20 + Math.floor(r() * 40)
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28
        const d = rad * Math.sqrt(r())
        pushGrass(cx + Math.cos(a) * d, cz + Math.sin(a) * d, d < rad * 0.5 ? 0.15 : 0)
      }
    }
    for (let i = 0; i < 500; i++) pushGrass(PLAZA.minX + r() * (PLAZA.maxX - PLAZA.minX), PLAZA.minZ - 2 + r() * (PLAZA.maxZ - PLAZA.minZ + 4), -0.1)
    // Denser along walls, pedestals and tree pits.
    for (let i = 0; i < 500; i++) pushGrass(-42 + r() * 2, -30 + r() * 62, 0.2)
    for (let i = 0; i < 400; i++) pushGrass(-22 + r() * 44, -31.5 + r() * 1.6, 0.2)
    for (const s of SCULPTURES)
      for (let i = 0; i < 40; i++) {
        const a = r() * 6.28
        const d = (PEDESTAL_SIZE / 2) * s.scale * 1.2 + r() * 0.8
        pushGrass(s.at[0] + Math.cos(a) * d, s.at[2] + Math.sin(a) * d, 0.25)
      }
    for (const [x, z] of [...TREES, ...PALMS])
      for (let i = 0; i < 18; i++) pushGrass(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 0.25)

    const bushes: Inst[] = []
    const pushBush = (x: number, z: number, big: number) => {
      if (insideBox(x, z, 0.3)) return
      const s = (0.35 + r() * 0.6) * big
      bushes.push({
        p: [x, s * 0.42, z],
        r: [0, r() * 6, 0],
        s: [s * 1.5, s * (0.9 + r() * 0.4), s * 1.5],
        c: new THREE.Color().setHSL(0.2 + r() * 0.09, 0.3 + r() * 0.2, 0.42 + r() * 0.2),
        t: 0.2 + r() * 0.6,
      })
    }
    for (let i = 0; i < 90; i++) pushBush(-42.3 + r() * 1.5, -29 + r() * 60, 1.3)
    for (let i = 0; i < 70; i++) pushBush(-22 + r() * 44, -31 + r(), 1.2)
    for (let i = 0; i < 120; i++) pushBush(PLAZA.minX + r() * 84, PLAZA.minZ + r() * 62, 0.9)
    for (const [x, z] of [...TREES, ...PALMS]) for (let i = 0; i < 4; i++) pushBush(x + (r() - 0.5) * 2.5, z + (r() - 0.5) * 2.5, 1.1)

    const ivy: Inst[] = []
    const frontZ = PALACIO.z + PALACIO.depth / 2 + 0.03
    for (const x of [-20.5, -15, -10, 10, 15.5, 20.5]) {
      const h = 5 + r() * 9
      ivy.push({ p: [x + (r() - 0.5), 0, frontZ], s: [3 + r() * 3, h, 1], t: 0.2 + r() * 0.4 })
    }
    const eastX = MUSEO.x + MUSEO.width / 2 + 0.25
    for (let z = MUSEO.z - 24; z <= MUSEO.z + 24; z += 6.5) {
      if (Math.abs(z - MUSEO.z) < 5) continue
      ivy.push({ p: [eastX, 0, z + (r() - 0.5) * 2], r: [0, Math.PI / 2, 0], s: [3 + r() * 3, 4 + r() * 10, 1], t: 0.2 + r() * 0.45 })
    }
    for (const s of SCULPTURES) {
      const half = (PEDESTAL_SIZE / 2) * s.scale + 0.02
      ivy.push({ p: [s.at[0], 0, s.at[2] + half], s: [2 + r(), 1.1 + r() * 0.5, 1], t: 0.3 + r() * 0.3 })
      ivy.push({ p: [s.at[0] + half, 0, s.at[2]], r: [0, Math.PI / 2, 0], s: [1.6 + r(), 1 + r() * 0.5, 1], t: 0.35 + r() * 0.3 })
    }
    return { trunks, fronds, tTrunks, canopy, grass, bushes, ivy }
  }, [])

  useFrame(({ clock }) => {
    windTime.value = clock.elapsedTime
  })

  const rTrunk = useRef<THREE.InstancedMesh>(null)
  const rFrond = useRef<THREE.InstancedMesh>(null)
  const rTT = useRef<THREE.InstancedMesh>(null)
  const rCan = useRef<THREE.InstancedMesh>(null)
  const rGrass = useRef<THREE.InstancedMesh>(null)
  const rBush = useRef<THREE.InstancedMesh>(null)
  const rIvy = useRef<THREE.InstancedMesh>(null)
  useInstances(rTrunk, data.trunks)
  useInstances(rFrond, data.fronds)
  useInstances(rTT, data.tTrunks)
  useInstances(rCan, data.canopy)
  useInstances(rGrass, data.grass)
  useInstances(rBush, data.bushes)
  useInstances(rIvy, data.ivy)

  return (
    <group>
      <instancedMesh ref={rTrunk} args={[geo.trunk, mat.trunk, data.trunks.length]} castShadow receiveShadow />
      <instancedMesh ref={rFrond} args={[geo.frond, mat.frond, data.fronds.length]} castShadow />
      <instancedMesh ref={rTT} args={[geo.treeTrunk, mat.treeTrunk, data.tTrunks.length]} castShadow />
      <instancedMesh ref={rCan} args={[geo.blob, mat.canopy, data.canopy.length]} castShadow receiveShadow customDepthMaterial={mat.leafDepth} />
      <instancedMesh ref={rGrass} args={[geo.blade, mat.grass, data.grass.length]} receiveShadow />
      <instancedMesh ref={rBush} args={[geo.bush, mat.bush, data.bushes.length]} castShadow receiveShadow customDepthMaterial={mat.grassDepth} />
      <instancedMesh ref={rIvy} args={[geo.ivy, mat.ivy, data.ivy.length]} receiveShadow customDepthMaterial={mat.ivyDepth} />
    </group>
  )
})
