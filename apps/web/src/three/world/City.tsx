import { memo, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { patchRuin, rng } from './ruinShader'
import { lightLevel } from './Lighting'

type Block = { x: number; z: number; w: number; d: number; h: number; burnt: boolean; tint: THREE.Color }

// Medellín skyline: lots of exposed brick, plus white and gray concrete.
const PALETTE = ['#b5654a', '#a8583e', '#c47a55', '#e6e0d4', '#a29f98', '#d6c7a4', '#8f8a82', '#b5654a']

const FLOOR = 3.6
const BAY = 4

function cityBlocks(): Block[] {
  const r = rng(97)
  const out: Block[] = []
  const add = (x: number, z: number, maxH: number) => {
    let w = 10 + r() * 12
    const d = 10 + r() * 12
    if (x > 50) w = Math.min(w, 2 * (x - 59))
    const h = Math.round((8 + r() * maxH) / FLOOR) * FLOOR
    out.push({ x, z, w, d, h, burnt: r() < 0.35, tint: new THREE.Color(PALETTE[Math.floor(r() * PALETTE.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08) })
  }
  // East, south, north and west rows around the plaza, leaving streets free.
  // East rows start past the Metro viaduct (x ≈ 52).
  for (let z = -96; z <= 96; z += 24) for (let x = 74; x <= 170; x += 24) add(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, x < 100 ? 34 : 60)
  for (let x = -132; x <= 36; x += 24) for (let z = 52; z <= 148; z += 24) add(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, z < 80 ? 26 : 56)
  for (let x = -132; x <= 36; x += 24) for (let z = -70; z >= -150; z -= 24) {
    if (Math.abs(x) < 30 && z > -76) continue
    add(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 50)
  }
  for (let z = -46; z <= 30; z += 24) for (let x = -84; x >= -150; x -= 24) add(x, z, 44)
  return out
}

function blockGeometry(b: Block) {
  const g = new THREE.BoxGeometry(b.w, b.h, b.d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // Face order: +x, -x, +y, -y, +z, -z; 4 vertices each. Scale UVs to meters so windows repeat per bay.
  const faces: [number, number][] = [
    [b.d / BAY, b.h / FLOOR],
    [b.d / BAY, b.h / FLOOR],
    [0.05, 0.05],
    [0.05, 0.05],
    [b.w / BAY, b.h / FLOOR],
    [b.w / BAY, b.h / FLOOR],
  ]
  faces.forEach(([su, sv], f) => {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
    }
  })
  g.translate(b.x, b.h / 2, b.z)
  const cols = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < cols.length; i += 3) {
    cols[i] = b.tint.r
    cols[i + 1] = b.tint.g
    cols[i + 2] = b.tint.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  return g
}

function colored(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('uv')
  return g.index ? g.toNonIndexed() : g
}

// Roof clutter that breaks the box silhouettes: parapets, stair houses, water tanks, antennas.
function rooftops(blocks: Block[]) {
  const r = rng(211)
  const parts: THREE.BufferGeometry[] = []
  const concrete = new THREE.Color('#9d978d')
  const dark = new THREE.Color('#4a4744')
  const tank = new THREE.Color('#2f5f8a')
  for (const b of blocks) {
    const top = b.h
    const edge = b.tint.clone().multiplyScalar(0.85)
    parts.push(colored(new THREE.BoxGeometry(b.w + 0.3, 1, 0.3).translate(b.x, top + 0.5, b.z - b.d / 2), edge))
    parts.push(colored(new THREE.BoxGeometry(b.w + 0.3, 1, 0.3).translate(b.x, top + 0.5, b.z + b.d / 2), edge))
    parts.push(colored(new THREE.BoxGeometry(0.3, 1, b.d).translate(b.x - b.w / 2, top + 0.5, b.z), edge))
    parts.push(colored(new THREE.BoxGeometry(0.3, 1, b.d).translate(b.x + b.w / 2, top + 0.5, b.z), edge))
    const sx = b.x + (r() - 0.5) * b.w * 0.5
    const sz = b.z + (r() - 0.5) * b.d * 0.5
    parts.push(colored(new THREE.BoxGeometry(3.2, 2.8, 3.2).translate(sx, top + 1.4, sz), concrete))
    if (r() < 0.75) {
      const tx = b.x + (r() - 0.5) * b.w * 0.6
      const tz = b.z + (r() - 0.5) * b.d * 0.6
      parts.push(colored(new THREE.CylinderGeometry(1.1, 1.1, 2, 10).translate(tx, top + 2.6, tz), tank))
      parts.push(colored(new THREE.BoxGeometry(2.2, 1.6, 2.2).translate(tx, top + 0.8, tz), dark))
    }
    if (r() < 0.4) parts.push(colored(new THREE.CylinderGeometry(0.06, 0.08, 6, 4).translate(sx + 1, top + 5.8, sz), dark))
  }
  return mergeGeometries(parts)
}

function mountainRing() {
  const r = rng(131)
  const seg = 120
  const rings = 7
  const inner = 280
  const outer = 620
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const green = new THREE.Color('#5d7448')
  const dark = new THREE.Color('#3f5536')
  const brick = new THREE.Color('#9a5a3e')
  const c = new THREE.Color()
  const phase = [r() * 6, r() * 6, r() * 6]
  for (let j = 0; j <= rings; j++) {
    const t = j / rings
    const rad = inner + (outer - inner) * t
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const n = Math.sin(a * 3 + phase[0]) * 0.5 + Math.sin(a * 7 + phase[1]) * 0.3 + Math.sin(a * 13 + phase[2]) * 0.15 + (r() - 0.5) * 0.2
      const h = t === 0 ? -2 : Math.pow(t, 0.8) * (150 + n * 90) + (r() - 0.5) * 8
      pos.push(Math.cos(a) * rad, h, Math.sin(a) * rad)
      // Lower slopes speckled with brick houses (the comunas), greener up high.
      const houses = t < 0.55 && r() < 0.75 - t
      c.copy(houses ? brick : r() < 0.5 ? green : dark).offsetHSL(0, 0, (r() - 0.5) * 0.06)
      col.push(c.r, c.g, c.b)
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * seg + i
      const b = j * seg + ((i + 1) % seg)
      const c2 = (j + 1) * seg + i
      const d = (j + 1) * seg + ((i + 1) % seg)
      idx.push(a, c2, b, b, c2, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g.toNonIndexed()
}

// minRadius keeps the skyline away from other locations' grounds (the UdeA campus reuses it as a backdrop).
export const City = memo(function City({ minRadius = 0, avoidZ }: { minRadius?: number; avoidZ?: [number, number] }) {
  const { tex, uRuin } = useWorld()

  const { normal, burnt, mountains, roofs } = useMemo(() => {
    const blocks = cityBlocks().filter(
      (b) => Math.hypot(b.x, b.z) - Math.max(b.w, b.d) / 2 > minRadius && !(avoidZ && b.z + b.d / 2 > avoidZ[0] && b.z - b.d / 2 < avoidZ[1]),
    )
    const geos = (list: Block[]) => mergeGeometries(list.map(blockGeometry))
    return { normal: geos(blocks.filter((b) => !b.burnt)), burnt: geos(blocks.filter((b) => b.burnt)), mountains: mountainRing(), roofs: rooftops(blocks) }
  }, [minRadius, avoidZ?.[0], avoidZ?.[1]])

  const mats = useMemo(() => {
    const base = { map: tex.facade, emissiveMap: tex.facadeEmissive, emissive: new THREE.Color('#ffb35c'), roughness: 0.9, vertexColors: true }
    const n = patchRuin(new THREE.MeshStandardMaterial({ ...base, emissiveIntensity: 0.25 }), uRuin, { tint: { color: '#6d665d', amount: 0.25 } })
    const b = patchRuin(new THREE.MeshStandardMaterial({ ...base, emissiveIntensity: 0.25 }), uRuin, { tint: { color: '#221d1a', amount: 0.85 } })
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
    const roof = patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), uRuin, { tint: { color: '#2a2522', amount: 0.4 } })
    return { n, b, m, roof }
  }, [tex, uRuin])

  useFrame(() => {
    const ruin = uRuin.value
    mats.n.emissiveIntensity = lightLevel.night * 1.1 * (1 - ruin * 0.65)
    mats.b.emissiveIntensity = lightLevel.night * 0.8 * (1 - ruin)
  })

  useEffect(
    () => () => {
      normal.dispose()
      burnt.dispose()
      mountains.dispose()
      roofs.dispose()
    },
    [normal, burnt, mountains, roofs],
  )

  return (
    <group>
      <mesh geometry={normal} material={mats.n} castShadow receiveShadow />
      <mesh geometry={burnt} material={mats.b} castShadow receiveShadow />
      <mesh geometry={mountains} material={mats.m} />
      <mesh geometry={roofs} material={mats.roof} castShadow receiveShadow />
    </group>
  )
})
