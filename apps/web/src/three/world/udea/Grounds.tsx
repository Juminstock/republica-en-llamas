import { memo, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from '../context'
import { pbrMaterial } from '../pbr'
import { patchRuin } from '../ruinShader'
import { patchWet } from '../wet'
import { FENCE_Z, GATE, PLAZOLETA } from './layout'

type Rect = { x: number; z: number; w: number; d: number }

// Hard surfaces of the campus: plazoleta, walkways and the street outside the gate.
const PATHS: Rect[] = [
  { x: (PLAZOLETA.minX + PLAZOLETA.maxX) / 2, z: (PLAZOLETA.minZ + PLAZOLETA.maxZ) / 2, w: PLAZOLETA.maxX - PLAZOLETA.minX, d: PLAZOLETA.maxZ - PLAZOLETA.minZ },
  { x: GATE.x, z: (PLAZOLETA.maxZ + FENCE_Z) / 2, w: 9, d: FENCE_Z - PLAZOLETA.maxZ + 1 },
  { x: -36, z: -3, w: 6, d: 10 },
  { x: 29, z: 0, w: 14, d: 50 },
  { x: 6, z: -27, w: 50, d: 6 },
  { x: -20, z: 40, w: 30, d: 4 },
  { x: 18, z: 38, w: 26, d: 4 },
  { x: 44, z: 34, w: 4, d: 20 },
  { x: -46, z: 20, w: 4, d: 30 },
]

function slab(r: Rect, y: number) {
  const g = new THREE.PlaneGeometry(r.w, r.d)
  g.rotateX(-Math.PI / 2)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * r.w + r.x) / 4, (uv.getY(i) * r.d - r.z) / 4)
  return g.translate(r.x, y, r.z)
}

function pavingLines() {
  const parts: THREE.BufferGeometry[] = []
  const { minX, maxX, minZ, maxZ } = PLAZOLETA
  for (let x = minX + 6; x < maxX; x += 6) parts.push(new THREE.PlaneGeometry(0.12, maxZ - minZ).rotateX(-Math.PI / 2).translate(x, 0.008, (minZ + maxZ) / 2))
  for (let z = minZ + 6; z < maxZ; z += 6) parts.push(new THREE.PlaneGeometry(maxX - minX, 0.12).rotateX(-Math.PI / 2).translate((minX + maxX) / 2, 0.008, z))
  // A large ring around the monument like the inlaid circles of the plazoleta.
  parts.push(new THREE.RingGeometry(9, 9.3, 64).rotateX(-Math.PI / 2).translate(-8, 0.009, -14))
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))
}

export const UdeAGrounds = memo(function UdeAGrounds() {
  const { tex, uRuin } = useWorld()
  const geo = useMemo(() => {
    const paths = mergeGeometries(PATHS.map((r, i) => slab(r, 0.004 + i * 0.0004).toNonIndexed()))
    const field = new THREE.PlaneGeometry(64, 90).rotateX(-Math.PI / 2).translate(108, 0.01, 18)
    const fieldLines: THREE.BufferGeometry[] = []
    for (const z of [-25, 18, 61]) fieldLines.push(new THREE.PlaneGeometry(56, 0.25).rotateX(-Math.PI / 2).translate(108, 0.02, z))
    for (const x of [80, 136]) fieldLines.push(new THREE.PlaneGeometry(0.25, 86).rotateX(-Math.PI / 2).translate(x, 0.02, 18))
    fieldLines.push(new THREE.RingGeometry(8.6, 8.9, 48).rotateX(-Math.PI / 2).translate(108, 0.02, 18))
    return { paths, lines: pavingLines(), field, fieldLines: mergeGeometries(fieldLines.map((g) => g.toNonIndexed())) }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(() => {
    const ruinMap = tex.ruin.clone()
    ruinMap.repeat.set(1, 1)
    ruinMap.needsUpdate = true
    return {
      lawn: patchRuin(pbrMaterial('grass', { repeat: [100, 100], color: '#8fbf62', normal: 0.8 }), uRuin, { tint: { color: '#6f6a3a', amount: 0.4 } }),
      paths: patchWet(patchRuin(pbrMaterial('concreteFloor', { color: '#ece4d6' }), uRuin, { tint: { color: '#6b604f', amount: 0.3 } }), 1 / 18),
      lines: patchRuin(new THREE.MeshStandardMaterial({ color: '#cfc9bd', roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), uRuin, { tint: { color: '#6b604f', amount: 0.6 } }),
      street: patchWet(pbrMaterial('asphalt', { repeat: [40, 8], color: '#8a8884' }), 1 / 30),
      field: patchRuin(new THREE.MeshStandardMaterial({ color: '#4f7a34', roughness: 0.95 }), uRuin, { tint: { color: '#7a6a3a', amount: 0.55 } }),
      overlay: new THREE.MeshStandardMaterial({ map: ruinMap, transparent: true, opacity: 0, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
    }
  }, [tex, uRuin])

  useFrame(() => {
    mats.overlay.opacity = Math.min(1, uRuin.value * 1.1)
  })

  const { minX, maxX, minZ, maxZ } = PLAZOLETA

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} material={mats.lawn} receiveShadow>
        <planeGeometry args={[420, 420]} />
      </mesh>
      <mesh geometry={geo.paths} material={mats.paths} receiveShadow />
      <mesh geometry={geo.lines} material={mats.lines} receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, (FENCE_Z + 96) / 2]} material={mats.street} receiveShadow>
        <planeGeometry args={[220, 96 - FENCE_Z]} />
      </mesh>
      <mesh geometry={geo.field} material={mats.field} receiveShadow />
      <mesh geometry={geo.fieldLines} material={mats.lines} />
      <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0.02, (minZ + maxZ) / 2]} material={mats.overlay} receiveShadow>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
      </mesh>
    </group>
  )
})
