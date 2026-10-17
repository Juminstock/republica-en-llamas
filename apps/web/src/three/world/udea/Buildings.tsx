import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from '../context'
import { meterBox, pbrMaterial } from '../pbr'
import { patchRuin } from '../ruinShader'
import { textTexture } from '../textures'
import { hipRoof } from './geometry'
import { ADMIN, BLOCKS, FENCE_Z, GATE, LIBRARY, POOL, TEATRO } from './layout'

const FLOOR_H = 3.4
const SOOT = { tint: { color: '#3b322c', amount: 0.42 } }

type Parts = { brick: THREE.BufferGeometry[]; white: THREE.BufferGeometry[]; glass: THREE.BufferGeometry[]; roof: THREE.BufferGeometry[]; roofLost: THREE.BufferGeometry[] }

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0) {
  if (rotY) g.rotateY(rotY)
  return g.translate(x, y, z)
}

// A campus block: brick walls, white floor slabs, ribbon windows with mullions, terracotta hip roof.
function brickBlock(p: Parts, b: { x: number; z: number; w: number; d: number; h: number }, opts: { collapsed?: boolean; monitor?: boolean } = {}) {
  const { x, z, w, d, h } = b
  p.brick.push(place(meterBox(w, h, d, 1.6), x, h / 2, z))
  const floors = Math.max(2, Math.round(h / FLOOR_H))
  for (let f = 0; f <= floors; f++) {
    const y = Math.min(h, f * (h / floors))
    p.white.push(place(meterBox(w + 0.36, 0.32, d + 0.36, 2), x, y, z))
  }
  for (let f = 0; f < floors; f++) {
    const y0 = f * (h / floors) + 0.95
    const wh = h / floors - 1.55
    for (const sz of [-1, 1]) {
      p.glass.push(place(meterBox(w - 2.4, wh, 0.08, 2), x, y0 + wh / 2, z + sz * (d / 2 + 0.03)))
      for (let mx = -w / 2 + 1.2; mx <= w / 2 - 1.2 + 0.01; mx += 1.6) p.white.push(place(meterBox(0.16, wh + 0.1, 0.22, 1), x + mx, y0 + wh / 2, z + sz * (d / 2 + 0.06)))
    }
    for (const sx of [-1, 1]) {
      p.glass.push(place(meterBox(0.08, wh, d - 2.4, 2), x + sx * (w / 2 + 0.03), y0 + wh / 2, z))
      for (let mz = -d / 2 + 1.2; mz <= d / 2 - 1.2 + 0.01; mz += 1.6) p.white.push(place(meterBox(0.22, wh + 0.1, 0.16, 1), x + sx * (w / 2 + 0.06), y0 + wh / 2, z + mz))
    }
  }
  const roof = place(hipRoof(w, d, Math.min(w, d) * 0.27, 1.3, 1.8), x, h + 0.16, z)
  ;(opts.collapsed ? p.roofLost : p.roof).push(roof)
  if (opts.monitor) {
    p.white.push(place(meterBox(Math.min(w, d) * 0.3, 1.4, Math.min(w, d) * 0.3, 1), x, h + Math.min(w, d) * 0.27 + 0.4, z))
    p.glass.push(place(meterBox(Math.min(w, d) * 0.3 + 0.05, 0.7, Math.min(w, d) * 0.3 + 0.05, 1), x, h + Math.min(w, d) * 0.27 + 0.5, z))
  }
}

function signMaterial(lines: string[], w: number, h: number, bg: string, fg: string) {
  return new THREE.MeshStandardMaterial({ map: textTexture(lines, { w, h, bg, fg }), roughness: 0.8 })
}

export const UdeABuildings = memo(function UdeABuildings() {
  const { uRuin } = useWorld()

  const geo = useMemo(() => {
    const p: Parts = { brick: [], white: [], glass: [], roof: [], roofLost: [] }
    BLOCKS.forEach((b, i) => brickBlock(p, b, { collapsed: i === 2, monitor: i === 1 || i === 4 }))

    // Library: main block plus a street-facing annex with the service window alcove (z -6..0).
    const lw = -40 - LIBRARY.minX
    brickBlock(p, { x: (LIBRARY.minX - 40) / 2, z: (LIBRARY.minZ + LIBRARY.maxZ) / 2, w: lw, d: LIBRARY.maxZ - LIBRARY.minZ, h: LIBRARY.height }, { monitor: true })
    const annex = (z0: number, z1: number) => p.brick.push(place(meterBox(2, LIBRARY.height - 1.5, z1 - z0, 1.6), -39, (LIBRARY.height - 1.5) / 2, (z0 + z1) / 2))
    annex(LIBRARY.minZ, -6)
    annex(0, LIBRARY.maxZ)
    p.white.push(place(meterBox(2.2, LIBRARY.height - 4.2, 6, 2), -39, 2.7 + (LIBRARY.height - 4.2) / 2 + 0.1, -3))
    p.white.push(place(meterBox(0.6, 1.05, 6, 1), -38.3, 0.52, -3))
    p.white.push(place(meterBox(2.6, 0.2, 7.2, 1), -37.6, 2.85, -3))

    // Teatro Universitario: pebble hall, stepped flat roofs with deep fascias, front colonnade and steps.
    const tx = TEATRO.x
    const back = TEATRO.z - TEATRO.depth / 2
    const front = -29
    const hallD = front - back
    const pebble: THREE.BufferGeometry[] = [place(meterBox(TEATRO.width, TEATRO.height, hallD, 3), tx, TEATRO.height / 2, (back + front) / 2)]
    const concrete: THREE.BufferGeometry[] = [
      place(meterBox(TEATRO.width + 3, 1.1, hallD + 3, 2), tx, TEATRO.height + 0.55, (back + front) / 2),
      place(meterBox(TEATRO.width - 12, 1.0, hallD - 7, 2), tx, TEATRO.height + 1.6, (back + front) / 2),
      place(meterBox(TEATRO.width - 24, 0.9, hallD - 12, 2), tx, TEATRO.height + 2.55, (back + front) / 2),
      place(meterBox(TEATRO.width + 1, 0.7, 5.6, 2), tx, 7.6, front + 2.6),
    ]
    for (let cx = tx - TEATRO.width / 2 + 2; cx <= tx + TEATRO.width / 2 - 1.9; cx += 4.4) {
      concrete.push(place(new THREE.CylinderGeometry(0.42, 0.55, 7.3, 4, 1).rotateY(Math.PI / 4).toNonIndexed(), cx, 3.65, -24.9))
    }
    concrete.push(place(meterBox(16.6, 1.5, 0.3, 1), tx, 8.7, -23.75))
    for (let k = 0; k < 4; k++) concrete.push(place(meterBox(30, 0.225 * (k + 1), 0.9, 1), tx, (0.225 * (k + 1)) / 2, -21.45 - k * 0.9))
    concrete.push(place(meterBox(TEATRO.width, 0.9, 4.5, 2), tx, 0.45, front + 2.2))
    p.glass.push(place(meterBox(TEATRO.width - 8, 4.4, 0.1, 2), tx, 3.1, front + 0.06))

    // Admin block on pilotis beside the reflecting pool.
    const aw = ADMIN.maxX - ADMIN.minX
    const ad = ADMIN.maxZ - ADMIN.minZ
    const acx = (ADMIN.minX + ADMIN.maxX) / 2
    const acz = (ADMIN.minZ + ADMIN.maxZ) / 2
    pebble.push(place(meterBox(aw, ADMIN.height, ad, 3), acx, ADMIN.floorY + ADMIN.height / 2, acz))
    concrete.push(place(meterBox(aw + 1.6, 0.7, ad + 1.6, 2), acx, ADMIN.floorY + ADMIN.height + 0.35, acz))
    concrete.push(place(meterBox(aw + 0.6, 0.6, ad + 0.6, 2), acx, ADMIN.floorY - 0.3, acz))
    for (const z of [-22, -12, -2, 8, 18]) for (const x of [36, 42]) concrete.push(place(new THREE.CylinderGeometry(0.42, 0.42, ADMIN.floorY, 10).toNonIndexed(), x, ADMIN.floorY / 2, z))
    p.glass.push(place(meterBox(10, ADMIN.floorY - 0.6, 22, 2), 51, (ADMIN.floorY - 0.6) / 2, -1))
    for (let f = 0; f < 3; f++) {
      const y = ADMIN.floorY + 1 + f * 3.1
      p.glass.push(place(meterBox(0.08, 1.7, ad - 3, 2), ADMIN.minX - 0.04, y + 0.85, acz))
      for (let z = ADMIN.minZ + 1.5; z <= ADMIN.maxZ - 1.5; z += 2) concrete.push(place(meterBox(0.5, 2.2, 0.22, 1), ADMIN.minX - 0.25, y + 0.85, z))
    }
    // Reflecting pool curb
    const pw = POOL.maxX - POOL.minX
    const pd = POOL.maxZ - POOL.minZ
    const pcx = (POOL.minX + POOL.maxX) / 2
    const pcz = (POOL.minZ + POOL.maxZ) / 2
    for (const s of [-1, 1]) {
      concrete.push(place(meterBox(0.5, 0.5, pd + 0.5, 1), pcx + (s * (pw + 0.5)) / 2, 0.25, pcz))
      concrete.push(place(meterBox(pw, 0.5, 0.5, 1), pcx, 0.25, pcz + (s * (pd + 0.5)) / 2))
    }

    // Gate: stone pillars, cream central block, tile canopy, guard booth, low wall with iron bars.
    const stone: THREE.BufferGeometry[] = []
    const iron: THREE.BufferGeometry[] = []
    const gx = GATE.x
    for (const s of [-1, 1]) stone.push(place(meterBox(1.8, 3.6, 1.8, 1), gx + s * (GATE.width / 2 + 0.9), 1.8, FENCE_Z))
    p.roof.push(place(hipRoof(GATE.width + 6, 4.2, 1.4, 0.6, 1.4), gx, 3.6, FENCE_Z))
    p.white.push(place(meterBox(GATE.width + 6.6, 0.3, 4.6, 1), gx, 3.5, FENCE_Z))
    p.brick.push(place(meterBox(6, 3, 4, 1.6), gx + 11, 1.5, FENCE_Z - 2.6))
    p.roof.push(place(hipRoof(6, 4, 1.4, 0.7, 1.4), gx + 11, 3.05, FENCE_Z - 2.6))
    for (const [x0, x1] of [
      [-70, gx - GATE.width / 2 - 1.8],
      [gx + GATE.width / 2 + 1.8, 70],
    ]) {
      stone.push(place(meterBox(x1 - x0, 0.8, 0.6, 1), (x0 + x1) / 2, 0.4, FENCE_Z))
      for (let x = x0 + 0.2; x < x1; x += 0.24) iron.push(place(new THREE.BoxGeometry(0.035, 1.5, 0.035).toNonIndexed(), x, 1.55, FENCE_Z))
      for (const y of [0.95, 2.2]) iron.push(place(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05).toNonIndexed(), (x0 + x1) / 2, y, FENCE_Z))
    }
    // Open gate leaves
    for (const [hx, ang] of [
      [gx - GATE.width / 2, -1.2],
      [gx + GATE.width / 2, 1.2],
    ] as const) {
      for (let k = 0; k < 12; k++) iron.push(new THREE.BoxGeometry(0.04, 2.4, 0.04).toNonIndexed().translate(k * 0.24 * Math.sign(-ang) + 0.1 * Math.sign(-ang), 1.25, 0).rotateY(ang).translate(hx, 0, FENCE_Z - 0.1))
    }

    const merge = (list: THREE.BufferGeometry[]) => {
      const flat = list.map((g) => (g.index ? g.toNonIndexed() : g))
      flat.forEach((g) => {
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
      })
      return mergeGeometries(flat)
    }
    return {
      brick: merge(p.brick),
      white: merge(p.white),
      glass: merge(p.glass),
      roof: merge(p.roof),
      roofLost: merge(p.roofLost),
      pebble: merge(pebble),
      concrete: merge(concrete),
      stone: merge(stone),
      iron: merge(iron),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(() => {
    const roofLost = pbrMaterial('roof', { color: '#e6a07a', normal: 1.2 })
    return {
      brick: patchRuin(pbrMaterial('brick', { color: '#e6b39a', normal: 1.1 }), uRuin, SOOT),
      white: patchRuin(pbrMaterial('plaster', { color: '#efe9de' }), uRuin, SOOT),
      glass: patchRuin(new THREE.MeshStandardMaterial({ color: '#20313a', metalness: 0.65, roughness: 0.12 }), uRuin, { tint: { color: '#0d0c0b', amount: 0.75 } }),
      roof: patchRuin(pbrMaterial('roof', { color: '#e6a07a', normal: 1.2 }), uRuin, { tint: { color: '#4a3a2a', amount: 0.3 } }),
      roofLost: patchRuin(roofLost, uRuin, { appear: 0.55, invert: true }),
      pebble: patchRuin(pbrMaterial('pebble', { color: '#cfc6b6', normal: 1.3 }), uRuin, SOOT),
      concrete: patchRuin(pbrMaterial('concrete', { color: '#d4cec4' }), uRuin, SOOT),
      stone: patchRuin(pbrMaterial('pebble', { color: '#9c9488', normal: 1.6 }), uRuin, SOOT),
      iron: patchRuin(new THREE.MeshStandardMaterial({ color: '#2a2c2e', metalness: 0.7, roughness: 0.5 }), uRuin, { tint: { color: '#5a3018', amount: 0.6 } }),
      signGate: signMaterial(['UNIVERSIDAD', 'DE ANTIOQUIA'], 512, 300, '#efe6cf', '#3a3428'),
      signTeatro: signMaterial(['TEATRO UNIVERSITARIO'], 1024, 120, '#d4cec4', '#2f2b26'),
      signLibrary: signMaterial(['BIBLIOTECA', 'CARLOS GAVIRIA DÍAZ'], 512, 220, '#1f3b57', '#f4efe1'),
      banner1: signMaterial(['AGENDA', 'CULTURAL'], 256, 512, '#c8384a', '#fff6e8'),
      banner2: signMaterial(['ALMA', 'MÁTER'], 256, 512, '#2a8c8a', '#fff6e8'),
      water: patchRuin(new THREE.MeshStandardMaterial({ color: '#40565c', metalness: 0.1, roughness: 0.04, envMapIntensity: 1.4 }), uRuin, { tint: { color: '#3a4a22', amount: 0.75 } }),
      emblem: new THREE.MeshStandardMaterial({ color: '#b8973e', metalness: 0.7, roughness: 0.35 }),
    }
  }, [uRuin])

  return (
    <group>
      <mesh geometry={geo.brick} material={mats.brick} castShadow receiveShadow />
      <mesh geometry={geo.white} material={mats.white} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mats.glass} receiveShadow />
      <mesh geometry={geo.roof} material={mats.roof} castShadow receiveShadow />
      <mesh geometry={geo.roofLost} material={mats.roofLost} castShadow receiveShadow />
      <mesh geometry={geo.pebble} material={mats.pebble} castShadow receiveShadow />
      <mesh geometry={geo.concrete} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={geo.stone} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={geo.iron} material={mats.iron} castShadow />
      {/* Reflecting pool */}
      <mesh material={mats.water} rotation-x={-Math.PI / 2} position={[(POOL.minX + POOL.maxX) / 2, 0.28, (POOL.minZ + POOL.maxZ) / 2]} receiveShadow>
        <planeGeometry args={[POOL.maxX - POOL.minX, POOL.maxZ - POOL.minZ]} />
      </mesh>
      {/* Gate: cream central block with emblem and name */}
      <group position={[GATE.x, 0, FENCE_Z]}>
        <mesh material={mats.white} position={[0, 1.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 3.4, 1.2]} />
        </mesh>
        <mesh material={mats.signGate} position={[0, 1.55, 0.61]}>
          <planeGeometry args={[2.8, 1.64]} />
        </mesh>
        <mesh material={mats.emblem} position={[0, 2.85, 0.62]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.32, 0.32, 0.06, 24]} />
        </mesh>
      </group>
      {/* Signs and banners */}
      <mesh material={mats.signTeatro} position={[TEATRO.x, 8.7, -23.58]}>
        <planeGeometry args={[16, 1.3]} />
      </mesh>
      <mesh material={mats.banner1} position={[TEATRO.x - 15, 3.4, -24.4]}>
        <planeGeometry args={[1.6, 3.2]} />
      </mesh>
      <mesh material={mats.banner2} position={[TEATRO.x + 20, 3.4, -24.4]}>
        <planeGeometry args={[1.6, 3.2]} />
      </mesh>
      <mesh material={mats.signLibrary} position={[-37.86, 3.9, -3]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[5.2, 1.4]} />
      </mesh>
    </group>
  )
})
