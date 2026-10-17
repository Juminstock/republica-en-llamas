import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useWorld } from '../context'
import { useInstances, type Inst } from '../instancing'
import { carGeometry, busGeometry, jerseyGeometry } from '../Ruins'
import { patchRuin, ruinDepthMaterial, rng } from '../ruinShader'
import { BLOCKS, TEATRO } from './layout'

type GraffitiSpec = { text: string; at: [number, number, number]; rotY: number; w: number; color: string; from: number }

const GRAFFITI: GraffitiSpec[] = [
  { text: 'LA U NO SE VENDE', at: [TEATRO.x - 8, 6.2, -28.94], rotY: 0, w: 9, color: '#d7263d', from: 0.3 },
  { text: '¿Y LAS PASANTÍAS?', at: [TEATRO.x + 12, 6.1, -28.94], rotY: 0, w: 8, color: '#1d1d20', from: 0.35 },
  { text: 'FUERA TANQUES', at: [-37.95, 2.3, 8], rotY: Math.PI / 2, w: 6, color: '#2b5a2b', from: 0.4 },
  { text: 'AQUÍ ESTUDIÁBAMOS', at: [33.95, 7.6, 14], rotY: -Math.PI / 2, w: 8, color: '#f2b705', from: 0.45 },
  { text: 'PARO', at: [-10, 2.4, 38.95], rotY: Math.PI, w: 4, color: '#d7263d', from: 0.35 },
]

function graffitiTexture(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 220
  const ctx = c.getContext('2d')!
  const r = rng(text.length * 31)
  ctx.font = '900 150px Impact, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  while (ctx.measureText(text).width > 980) ctx.font = ctx.font.replace(/\d+px/, (m) => `${parseInt(m) - 6}px`)
  ctx.save()
  ctx.translate(512, 110)
  ctx.rotate(-0.04)
  // Overspray halo, then the drip-free fill.
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.fillStyle = color
  ctx.fillText(text, 0, 0)
  ctx.shadowBlur = 0
  ctx.fillText(text, 0, 0)
  ctx.restore()
  ctx.fillStyle = color
  for (let i = 0; i < 26; i++) {
    const x = 60 + r() * 900
    ctx.fillRect(x, 130 + r() * 20, 3, 20 + r() * 50)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// The campus after the war: burnt vehicles, barricades, rubble, a collapsed roof, graffiti, protest remnants.
export const UdeAWar = memo(function UdeAWar() {
  const { tex, uRuin } = useWorld()
  const geo = useMemo(() => ({ car: carGeometry(), bus: busGeometry(), jersey: jerseyGeometry(), tire: new THREE.TorusGeometry(0.34, 0.14, 8, 16).rotateX(Math.PI / 2) }), [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mat = useMemo(() => {
    const appear = { appear: 'instance' as const }
    return {
      vehicle: patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }), uRuin, { ...appear, tint: { color: '#231d19', amount: 0.75 } }),
      concrete: patchRuin(new THREE.MeshStandardMaterial({ color: '#b5afa4', roughness: 0.95 }), uRuin, appear),
      sand: patchRuin(new THREE.MeshStandardMaterial({ color: '#a8946c', roughness: 1 }), uRuin, appear),
      rubble: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), uRuin, appear),
      tire: patchRuin(new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.8 }), uRuin, appear),
      slab: patchRuin(new THREE.MeshStandardMaterial({ color: '#b8653f', roughness: 0.9 }), uRuin, appear),
      scorch: patchRuin(
        new THREE.MeshBasicMaterial({ map: tex.soft, color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
        uRuin,
        appear,
      ),
      depth: ruinDepthMaterial(uRuin, appear),
    }
  }, [tex, uRuin])

  const data = useMemo(() => {
    const r = rng(77)
    const cars: Inst[] = [
      { p: [-18, 0, 12], r: [0, 0.7, 0.02], c: '#c9c3b8', t: 0.3 },
      { p: [16, 0, -6], r: [0.05, 2.1, 0], c: '#7a1f1f', t: 0.35 },
      { p: [-28, 0, 76], r: [0, 1.57, 0], c: '#2f4f6f', t: 0.25 },
      { p: [24, 0, 80], r: [0, 1.5, 0.03], c: '#d8d2c6', t: 0.3 },
      { p: [58, 0, 10], r: [0, 0.2, 0], c: '#3d3d3d', t: 0.4 },
      { p: [-2, 0, 52], r: [0, 1.2, 0], c: '#5a6b3a', t: 0.45 },
    ]
    const bus: Inst[] = [{ p: [-20, 0, 80], r: [0, 1.62, 0.02], c: '#d9a92c', t: 0.35 }]
    const jersey: Inst[] = []
    for (let i = 0; i < 4; i++) jersey.push({ p: [-15 + i * 3.1, 0, 64], r: [0, Math.PI / 2 + (r() - 0.5) * 0.2, 0], t: 0.25 + r() * 0.2 })
    for (let i = 0; i < 3; i++) jersey.push({ p: [4 + i * 3.1, 0, 64.5], r: [0, Math.PI / 2 + (r() - 0.5) * 0.2, 0], t: 0.25 + r() * 0.2 })
    const sandbags: Inst[] = []
    const wall = (x0: number, z0: number, len: number, rot: number, rows: number) => {
      const dir = [Math.cos(rot), -Math.sin(rot)]
      for (let row = 0; row < rows; row++)
        for (let i = 0; i < Math.floor(len / 0.95) - row; i++) {
          const d = (i + row * 0.5) * 0.95 - len / 2
          sandbags.push({ p: [x0 + dir[0] * d, 0.17 + row * 0.27, z0 + dir[1] * d], r: [0, rot + (r() - 0.5) * 0.25, 0], s: [0.5, 0.17, 0.3], t: 0.3 + r() * 0.25 })
        }
    }
    wall(-6, 58, 8, 0, 3)
    wall(20, -16, 6, Math.PI / 2, 3)
    wall(-26, -8, 6, Math.PI / 2, 2)
    const rubble: Inst[] = []
    const gray = new THREE.Color()
    const chunk = (x: number, z: number, big: number) => {
      const s = (0.14 + r() * 0.5) * big
      gray.setHSL(0.06, 0.1 + r() * 0.12, 0.32 + r() * 0.28)
      rubble.push({ p: [x, s * 0.4, z], r: [r() * 6, r() * 6, r() * 6], s: [s, s * (0.5 + r() * 0.6), s * (0.7 + r() * 0.6)], c: gray.clone(), t: 0.2 + r() * 0.6 })
    }
    // The collapsed block: its roof is gone and the rubble spills out.
    const col = BLOCKS[2]
    for (let i = 0; i < 150; i++) chunk(col.x + (r() - 0.5) * (col.w + 6), col.z + (r() - 0.5) * (col.d + 6), 1.8)
    for (const [px, pz] of [
      [TEATRO.x + 18, -26],
      [-34, 18],
      [44, 30],
      [-8, 66],
    ])
      for (let i = 0; i < 40; i++) {
        const a = r() * 6.28
        const d = Math.sqrt(r()) * 3.4
        chunk(px + Math.cos(a) * d, pz + Math.sin(a) * d, 1.5 - d * 0.3)
      }
    for (let i = 0; i < 120; i++) chunk(-34 + r() * 68, -24 + r() * 48, 0.6)
    const slabs: Inst[] = [
      { p: [col.x - 3, 4.2, col.z + 1], r: [0.5, 0.3, 0.25], s: [9, 0.35, 6], t: 0.55 },
      { p: [col.x + 5, 2.6, col.z - 1], r: [-0.35, -0.2, 0.6], s: [7, 0.35, 5], t: 0.58 },
    ]
    const tires: Inst[] = []
    for (const [x, z] of [
      [-8, 59],
      [-6.5, 59.6],
      [-3, 58.5],
      [18, -16],
      [12, -4],
    ])
      for (let k = 0; k < 3; k++) tires.push({ p: [x + (r() - 0.5) * 0.4, 0.14 + k * 0.26, z + (r() - 0.5) * 0.4], r: [0, r() * 3, 0], t: 0.3 + r() * 0.2 })
    const scorch: Inst[] = []
    for (const [x, z, s] of [
      [16, -6, 6],
      [-18, 12, 5],
      [6, -22, 4],
      [col.x, col.z, 16],
      [-6, 60, 5],
      [12, -4, 3],
    ])
      scorch.push({ p: [x, 0.03, z], r: [-Math.PI / 2, 0, r() * 6], s: [s, s * (0.7 + r() * 0.4), 1], t: 0.3 + r() * 0.3 })
    for (const x of [-10, 2, 16]) scorch.push({ p: [TEATRO.x + x, 6 + r() * 3, -28.96], s: [4, 5, 1], t: 0.35 + r() * 0.2 })
    return { cars, bus, jersey, sandbags, rubble, slabs, tires, scorch }
  }, [])

  const refs = {
    cars: useRef<THREE.InstancedMesh>(null),
    bus: useRef<THREE.InstancedMesh>(null),
    jersey: useRef<THREE.InstancedMesh>(null),
    sandbags: useRef<THREE.InstancedMesh>(null),
    rubble: useRef<THREE.InstancedMesh>(null),
    slabs: useRef<THREE.InstancedMesh>(null),
    tires: useRef<THREE.InstancedMesh>(null),
    scorch: useRef<THREE.InstancedMesh>(null),
  }
  ;(Object.keys(refs) as (keyof typeof refs)[]).forEach((k) => useInstances(refs[k], data[k]))

  return (
    <group>
      <instancedMesh ref={refs.cars} args={[geo.car, mat.vehicle, data.cars.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.bus} args={[geo.bus, mat.vehicle, data.bus.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.jersey} args={[geo.jersey, mat.concrete, data.jersey.length]} castShadow receiveShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.sandbags} args={[undefined, mat.sand, data.sandbags.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <sphereGeometry args={[1, 10, 6]} />
      </instancedMesh>
      <instancedMesh ref={refs.rubble} args={[undefined, mat.rubble, data.rubble.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={refs.slabs} args={[undefined, mat.slab, data.slabs.length]} castShadow receiveShadow customDepthMaterial={mat.depth}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={refs.tires} args={[geo.tire, mat.tire, data.tires.length]} castShadow customDepthMaterial={mat.depth} />
      <instancedMesh ref={refs.scorch} args={[undefined, mat.scorch, data.scorch.length]}>
        <planeGeometry />
      </instancedMesh>
      {GRAFFITI.map((g) => (
        <Graffiti key={g.text} spec={g} />
      ))}
    </group>
  )
})

const Graffiti = memo(function Graffiti({ spec }: { spec: GraffitiSpec }) {
  const { uRuin } = useWorld()
  const mat = useMemo(
    () =>
      patchRuin(
        new THREE.MeshStandardMaterial({ map: graffitiTexture(spec.text, spec.color), transparent: true, alphaTest: 0.05, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
        uRuin,
        { appear: spec.from },
      ),
    [spec, uRuin],
  )
  return (
    <mesh material={mat} position={spec.at} rotation-y={spec.rotY}>
      <planeGeometry args={[spec.w, spec.w * 0.215]} />
    </mesh>
  )
})
