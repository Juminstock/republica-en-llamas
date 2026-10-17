import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { useInstances, type Inst } from './instancing'
import { patchRuin } from './ruinShader'
import { textTexture } from './textures'
import type { Collider, Vec3 } from './layout'

export type Spot = { x: number; z: number; rotY: number }
export type Poster = { at: Vec3; rotY: number; lines: string[]; bg: string; fg: string; w?: number; h?: number; from?: number }

function paint(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g.index ? g.toNonIndexed() : g
}

function benchGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.75, 0.75]) parts.push(paint(new THREE.BoxGeometry(0.12, 0.45, 0.5).translate(x, 0.22, 0), '#2d3033'))
  for (let k = 0; k < 4; k++) parts.push(paint(new THREE.BoxGeometry(1.8, 0.05, 0.11).translate(0, 0.47, -0.18 + k * 0.12), '#7a5236'))
  for (let k = 0; k < 2; k++) parts.push(paint(new THREE.BoxGeometry(1.8, 0.1, 0.04).translate(0, 0.66 + k * 0.14, -0.27).rotateX(-0.12), '#7a5236'))
  for (const x of [-0.75, 0.75]) parts.push(paint(new THREE.BoxGeometry(0.06, 0.45, 0.06).translate(x, 0.68, -0.27), '#2d3033'))
  return mergeGeometries(parts)
}

function binGeometry() {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.26, 0.23, 0.85, 14, 1, true).translate(0, 0.45, 0), '#2f5a3a'),
    paint(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 14).translate(0, 0.9, 0), '#25472e'),
    paint(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6).translate(0, 0.1, 0), '#2d3033'),
  ])
}

function kioskGeometry() {
  return mergeGeometries([
    paint(new THREE.BoxGeometry(2.4, 2.3, 1.8).translate(0, 1.15, 0), '#2c5f8a'),
    paint(new THREE.BoxGeometry(2.9, 0.18, 2.4).translate(0, 2.42, 0.15), '#d9d3c5'),
    paint(new THREE.BoxGeometry(2.2, 0.08, 0.5).translate(0, 1.05, 1.1), '#d9d3c5'),
  ])
}

export const PROP_RADIUS = { bench: 0.9, bin: 0.35, kiosk: 1.5 }

export function propColliders(benches: Spot[], bins: Spot[], kiosks: Spot[]): Collider[] {
  return [
    ...benches.map((b) => ({ kind: 'circle' as const, x: b.x, z: b.z, r: PROP_RADIUS.bench })),
    ...bins.map((b) => ({ kind: 'circle' as const, x: b.x, z: b.z, r: PROP_RADIUS.bin })),
    ...kiosks.map((b) => ({ kind: 'circle' as const, x: b.x, z: b.z, r: PROP_RADIUS.kiosk })),
  ]
}

// Street furniture plus satirical posters; posters can appear only after the war via `from`.
export const StreetProps = memo(function StreetProps({ benches, bins, kiosks, posters }: { benches: Spot[]; bins: Spot[]; kiosks: Spot[]; posters: Poster[] }) {
  const { uRuin } = useWorld()
  const geo = useMemo(() => ({ bench: benchGeometry(), bin: binGeometry(), kiosk: kioskGeometry() }), [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const mat = useMemo(
    () => patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }), uRuin, { tint: { color: '#3b342d', amount: 0.45 } }),
    [uRuin],
  )
  const toInst = (s: Spot[]): Inst[] => s.map((b) => ({ p: [b.x, 0, b.z], r: [0, b.rotY, 0] }))
  const bench = useRef<THREE.InstancedMesh>(null)
  const bin = useRef<THREE.InstancedMesh>(null)
  const kiosk = useRef<THREE.InstancedMesh>(null)
  useInstances(bench, useMemo(() => toInst(benches), [benches]))
  useInstances(bin, useMemo(() => toInst(bins), [bins]))
  useInstances(kiosk, useMemo(() => toInst(kiosks), [kiosks]))

  return (
    <group>
      {benches.length > 0 && <instancedMesh ref={bench} args={[geo.bench, mat, benches.length]} castShadow receiveShadow />}
      {bins.length > 0 && <instancedMesh ref={bin} args={[geo.bin, mat, bins.length]} castShadow receiveShadow />}
      {kiosks.length > 0 && <instancedMesh ref={kiosk} args={[geo.kiosk, mat, kiosks.length]} castShadow receiveShadow />}
      {posters.map((p, i) => (
        <PosterMesh key={i} poster={p} />
      ))}
    </group>
  )
})

const PosterMesh = memo(function PosterMesh({ poster }: { poster: Poster }) {
  const { uRuin } = useWorld()
  const mat = useMemo(() => {
    const map = textTexture(poster.lines, { w: 384, h: 512, bg: poster.bg, fg: poster.fg, rough: true })
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.92, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
    return poster.from === undefined ? m : patchRuin(m, uRuin, { appear: poster.from })
  }, [poster, uRuin])
  return (
    <mesh material={mat} position={poster.at} rotation-y={poster.rotY} rotation-z={(poster.lines.length % 3) * 0.02 - 0.02}>
      <planeGeometry args={[poster.w ?? 0.9, poster.h ?? 1.2]} />
    </mesh>
  )
})
