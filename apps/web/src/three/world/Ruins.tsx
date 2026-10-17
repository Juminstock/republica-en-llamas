import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { useInstances, type Inst } from './instancing'
import { MUSEO, PALACIO, type Collider } from './layout'
import { patchRuin, ruinDepthMaterial, rng } from './ruinShader'

function painted(g: THREE.BufferGeometry, shade: number) {
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3).fill(shade)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g.toNonIndexed()
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, shade: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.deleteAttribute('uv')
  g.translate(x, y, z)
  return painted(g, shade)
}

function wheel(x: number, z: number, r: number) {
  const g = new THREE.CylinderGeometry(r, r, 0.28, 12)
  g.deleteAttribute('uv')
  g.rotateZ(Math.PI / 2)
  g.translate(x, r, z)
  return painted(g, 0.05)
}

export function carGeometry() {
  return mergeGeometries([
    box(1.85, 0.7, 4.3, 0, 0.62, 0, 1),
    box(1.62, 0.6, 2.1, 0, 1.27, -0.25, 0.08),
    box(1.64, 0.08, 1.9, 0, 1.6, -0.25, 1),
    box(1.9, 0.18, 0.2, 0, 0.45, 2.15, 0.25),
    box(1.9, 0.18, 0.2, 0, 0.45, -2.15, 0.25),
    ...[
      [0.86, 1.35],
      [-0.86, 1.35],
      [0.86, -1.35],
      [-0.86, -1.35],
    ].map(([x, z]) => wheel(x, z, 0.36)),
  ])
}

export function busGeometry() {
  return mergeGeometries([
    box(2.5, 2.5, 11, 0, 1.75, 0, 1),
    box(2.54, 0.85, 9.8, 0, 2.3, 0.2, 0.07),
    box(2.4, 1.2, 0.08, 0, 2.2, 5.52, 0.07),
    ...[
      [1.15, 3.6],
      [-1.15, 3.6],
      [1.15, -3.3],
      [-1.15, -3.3],
    ].map(([x, z]) => wheel(x, z, 0.52)),
  ])
}

export function jerseyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.32, 0)
  s.lineTo(0.32, 0)
  s.lineTo(0.12, 0.35)
  s.lineTo(0.1, 0.82)
  s.lineTo(-0.1, 0.82)
  s.lineTo(-0.12, 0.35)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false })
  g.translate(0, 0, -1.5)
  return g
}

const VEHICLES: { p: [number, number, number]; rotY: number; c: string; t: number; tilt?: number }[] = [
  { p: [-25, 0, 37], rotY: 1.57, c: '#c9c3b8', t: 0.25 },
  { p: [-8, 0, 38.2], rotY: 1.62, c: '#7a1f1f', t: 0.3 },
  { p: [12, 0, 37.4], rotY: 1.48, c: '#2f4f6f', t: 0.28 },
  { p: [47, 0, -20], rotY: 0.08, c: '#d8d2c6', t: 0.32 },
  { p: [46.5, 0, 6], rotY: -0.18, c: '#c0a030', t: 0.27 },
  { p: [-31, 0, -36], rotY: 0.9, c: '#3d3d3d', t: 0.35 },
  { p: [21, 0, -5.5], rotY: 0.7, c: '#e6e1d6', t: 0.45, tilt: 0.06 },
  { p: [-30, 0, 23.5], rotY: 2.2, c: '#5a6b3a', t: 0.5 },
  { p: [35, 0, -24], rotY: 1.2, c: '#8a2b1c', t: 0.42 },
]

export const RUIN_COLLIDERS: Collider[] = [
  ...VEHICLES.map((v) => ({ kind: 'circle' as const, x: v.p[0], z: v.p[2], r: 1.6 })),
  { kind: 'circle', x: 33, z: 26, r: 2.6 },
  { kind: 'circle', x: 30.4, z: 22.6, r: 2.6 },
  { kind: 'circle', x: 35.6, z: 29.4, r: 2.6 },
]

export const Ruins = memo(function Ruins() {
  const { tex, uRuin } = useWorld()

  const geo = useMemo(
    () => ({ car: carGeometry(), bus: busGeometry(), jersey: jerseyGeometry() }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mat = useMemo(() => {
    const appear = { appear: 'instance' as const }
    return {
      vehicle: patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }), uRuin, {
        ...appear,
        tint: { color: '#231d19', amount: 0.72 },
      }),
      bus: patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }), uRuin, {
        ...appear,
        tint: { color: '#1e1916', amount: 0.85 },
      }),
      concrete: patchRuin(new THREE.MeshStandardMaterial({ color: '#b5afa4', roughness: 0.95 }), uRuin, appear),
      sand: patchRuin(new THREE.MeshStandardMaterial({ color: '#a8946c', roughness: 1 }), uRuin, appear),
      rubble: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), uRuin, appear),
      drum: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.5 }), uRuin, appear),
      trash: patchRuin(new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.35 }), uRuin, appear),
      scorch: patchRuin(
        new THREE.MeshBasicMaterial({ map: tex.soft, color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
        uRuin,
        appear,
      ),
      depth: ruinDepthMaterial(uRuin, appear),
    }
  }, [tex, uRuin])

  const data = useMemo(() => {
    const r = rng(29)
    const cars: Inst[] = VEHICLES.map((v) => ({ p: v.p, r: [v.tilt ?? 0, v.rotY, (r() - 0.5) * 0.04], c: v.c, t: v.t }))
    const bus: Inst[] = [{ p: [33, 0, 26], r: [0, 0.9, 0.02], c: '#d9a92c', t: 0.35 }]

    const jersey: Inst[] = []
    for (const [x0, z0, rot, n] of [
      [47, -36, 0, 4],
      [-22, 36, Math.PI / 2, 3],
      [24, 35.5, Math.PI / 2, 3],
    ] as const)
      for (let i = 0; i < n; i++) {
        const along = i * 3.1
        jersey.push({ p: [x0 + (rot ? along : 0), 0, z0 + (rot ? 0 : along)], r: [0, rot + (r() - 0.5) * 0.15, 0], t: 0.25 + r() * 0.2 })
      }

    const sandbags: Inst[] = []
    const wall = (x0: number, z0: number, len: number, rot: number, rows: number) => {
      const dir = [Math.cos(rot), -Math.sin(rot)]
      for (let row = 0; row < rows; row++) {
        const count = Math.floor(len / 0.95) - row
        for (let i = 0; i < count; i++) {
          const d = (i + row * 0.5) * 0.95 - len / 2
          sandbags.push({
            p: [x0 + dir[0] * d, 0.17 + row * 0.27, z0 + dir[1] * d],
            r: [0, rot + (r() - 0.5) * 0.25, (r() - 0.5) * 0.1],
            s: [0.5, 0.17, 0.3],
            t: 0.3 + r() * 0.25,
          })
        }
      }
    }
    wall(-6.5, -26.5, 6, 0, 3)
    wall(6.5, -26.5, 6, 0, 3)
    wall(17.5, -13, 4, Math.PI / 2, 2)
    wall(38.5, 0, 7, Math.PI / 2, 3)
    wall(-12, 33, 5, 0.2, 2)

    const rubble: Inst[] = []
    const gray = new THREE.Color()
    const chunk = (x: number, z: number, big: number) => {
      const s = (0.12 + r() * 0.45) * big
      gray.setHSL(0.08, 0.06 + r() * 0.08, 0.35 + r() * 0.3)
      rubble.push({ p: [x, s * 0.4, z], r: [r() * 6, r() * 6, r() * 6], s: [s, s * (0.5 + r() * 0.6), s * (0.7 + r() * 0.6)], c: gray.clone(), t: 0.2 + r() * 0.6 })
    }
    const frontZ = PALACIO.z + PALACIO.depth / 2
    for (let i = 0; i < 70; i++) chunk(-21 + r() * 42, frontZ + 0.3 + r() * 1.6, 1)
    const eastX = MUSEO.x + MUSEO.width / 2
    for (let i = 0; i < 60; i++) chunk(eastX + 0.3 + r() * 1.6, MUSEO.z - 26 + r() * 52, 1)
    for (const [px, pz] of [
      [-37, -26],
      [38, 28],
      [-37, 31],
      [39, -28],
      [21, -3],
    ])
      for (let i = 0; i < 28; i++) {
        const a = r() * 6.28
        const d = Math.sqrt(r()) * 2.6
        chunk(px + Math.cos(a) * d, pz + Math.sin(a) * d, 1.6 - d * 0.35)
      }
    for (let i = 0; i < 70; i++) chunk(-40 + r() * 80, -28 + r() * 58, 0.6)

    const drumColors = ['#6b3a1f', '#2e4a6b', '#7a2a1a', '#3f4a2c', '#8a6a2a']
    const drums: Inst[] = []
    for (const [x, z] of [
      [12.5, 17.5],
      [3, 8],
      [14.5, 9],
      [-4, -25.5],
      [4.2, -25.8],
      [37.5, 4],
      [37.8, -4.5],
      [-31, -6],
      [-31, 19],
      [24.5, -19.5],
      [18.5, -14],
      [-14, 31],
    ])
      drums.push({ p: [x + (r() - 0.5) * 0.4, 0.45, z], r: [0, r() * 6, r() < 0.2 ? Math.PI / 2 : 0], c: drumColors[Math.floor(r() * drumColors.length)], t: 0.35 + r() * 0.25 })

    const trash: Inst[] = []
    for (let i = 0; i < 46; i++) {
      const s = 0.25 + r() * 0.2
      const edge = r()
      const x = edge < 0.5 ? -40 + r() * 3 : -40 + r() * 80
      const z = edge < 0.5 ? -28 + r() * 58 : 30 + r() * 2.5
      trash.push({ p: [x, s * 0.6, z], s: [s, s * 0.75, s * 0.9], r: [0, r() * 6, 0], t: 0.3 + r() * 0.5 })
    }

    const scorch: Inst[] = []
    for (const [x, z, s] of [
      [21, -5.5, 5],
      [-30, 23.5, 4.5],
      [35, -24, 4.5],
      [33, 26, 7],
      [-14, -12, 3],
      [6, -22, 3.5],
      [-24, 10, 2.5],
      [28, 14, 3],
    ])
      scorch.push({ p: [x, 0.025, z], r: [-Math.PI / 2, 0, r() * 6], s: [s, s * (0.7 + r() * 0.4), 1], t: 0.3 + r() * 0.3 })
    // Soot plumes above facade windows
    for (const x of [-17, -9, 12, 18]) scorch.push({ p: [x, 9 + r() * 6, frontZ + 0.05], s: [3.2, 4.5, 1], t: 0.35 + r() * 0.3 })
    for (const z of [-14, 8, 20]) scorch.push({ p: [eastX + 0.06, 8 + r() * 5, z], r: [0, Math.PI / 2, 0], s: [3, 4.2, 1], t: 0.35 + r() * 0.3 })

    return { cars, bus, jersey, sandbags, rubble, drums, trash, scorch }
  }, [])

  const refs = {
    cars: useRef<THREE.InstancedMesh>(null),
    bus: useRef<THREE.InstancedMesh>(null),
    jersey: useRef<THREE.InstancedMesh>(null),
    sandbags: useRef<THREE.InstancedMesh>(null),
    rubble: useRef<THREE.InstancedMesh>(null),
    drums: useRef<THREE.InstancedMesh>(null),
    trash: useRef<THREE.InstancedMesh>(null),
    scorch: useRef<THREE.InstancedMesh>(null),
  }
  useInstances(refs.cars, data.cars)
  useInstances(refs.bus, data.bus)
  useInstances(refs.jersey, data.jersey)
  useInstances(refs.sandbags, data.sandbags)
  useInstances(refs.rubble, data.rubble)
  useInstances(refs.drums, data.drums)
  useInstances(refs.trash, data.trash)
  useInstances(refs.scorch, data.scorch)

  return (
    <group>
      <instancedMesh ref={refs.cars} args={[geo.car, mat.vehicle, data.cars.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.bus} args={[geo.bus, mat.bus, data.bus.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.jersey} args={[geo.jersey, mat.concrete, data.jersey.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.sandbags} args={[undefined, mat.sand, data.sandbags.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <sphereGeometry args={[1, 10, 6]} />
      </instancedMesh>
      <instancedMesh ref={refs.rubble} args={[undefined, mat.rubble, data.rubble.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={refs.drums} args={[undefined, mat.drum, data.drums.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <cylinderGeometry args={[0.3, 0.3, 0.9, 14]} />
      </instancedMesh>
      <instancedMesh ref={refs.trash} args={[undefined, mat.trash, data.trash.length]} castShadow customDepthMaterial={mat.depth}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
      <instancedMesh ref={refs.scorch} args={[undefined, mat.scorch, data.scorch.length]}>
        <planeGeometry />
      </instancedMesh>
    </group>
  )
})
