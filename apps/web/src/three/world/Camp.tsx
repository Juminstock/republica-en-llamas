import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from './context'
import { useInstances, type Inst } from './instancing'
import { LANDMARKS, type Collider, type Vec3 } from './layout'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { patchRuin, ruinDepthMaterial, rng, smooth01 } from './ruinShader'

const [FX, , FZ] = LANDMARKS.campfire
const TENT_ANGLES = [-170, -120, -70, -20, 30, 175]
const TENT_R = 5.6
const TENT_COLORS = ['#2e5a87', '#c26a2c', '#4f6b3a', '#8a2d2d', '#b8a27a', '#3b3f55']

const tents = TENT_ANGLES.map((deg, i) => {
  const a = (deg * Math.PI) / 180
  const dx = Math.cos(a) * TENT_R
  const dz = Math.sin(a) * TENT_R
  return { x: FX + dx, z: FZ + dz, rotY: Math.atan2(-dx, -dz), color: TENT_COLORS[i] }
})

// Log seats around the fire for the opening scene: characters sit facing the flames.
export const CAMPFIRE_SEATS: { at: Vec3; rotY: number }[] = [110, 210, 330].map((deg) => {
  const a = (deg * Math.PI) / 180
  const dx = Math.cos(a) * 2.5
  const dz = Math.sin(a) * 2.5
  return { at: [FX + dx, 0.45, FZ + dz], rotY: Math.atan2(-dx, -dz) }
})

export const CAMP_COLLIDERS: Collider[] = tents.map((t) => ({ kind: 'circle', x: t.x, z: t.z, r: 1.5 }))

const STALLS = [
  { key: 'biblioteca', x: -34.3, z: -10, rotY: 0, sign: 'signBiblioteca' },
  { key: 'bienestar', x: -34.3, z: 14, rotY: 0, sign: 'signBienestar' },
  { key: 'tesoreria', x: 28.3, z: -16, rotY: Math.PI, sign: 'signTesoreria' },
] as const

// Scales a group in as ruin passes a range; the camp only exists after the war.
function useAppear(ref: React.RefObject<THREE.Object3D | null>, from: number, to: number) {
  const { uRuin } = useWorld()
  useFrame(() => {
    const k = smooth01(from, to, uRuin.value)
    if (!ref.current) return
    ref.current.visible = k > 0.001
    ref.current.scale.setScalar(Math.max(0.001, k))
  })
}

const flameVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const flameFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float h = vUv.y;
  float n = noise(vec2(vUv.x * 4.0 + uSeed, h * 3.0 - uTime * 2.6)) * 0.65 + noise(vec2(vUv.x * 9.0, h * 7.0 - uTime * 4.0)) * 0.35;
  float x = vUv.x - 0.5 + (n - 0.5) * 0.22 * h;
  float width = (1.0 - h) * 0.4 * (0.75 + 0.5 * n) + 0.02;
  float d = abs(x) / width;
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * (1.0 - smoothstep(0.45, 1.0, h + (n - 0.5) * 0.3));
  vec3 col = mix(vec3(0.95, 0.22, 0.03), vec3(1.0, 0.85, 0.45), clamp((1.0 - d) * (1.0 - h) * 1.6, 0.0, 1.0));
  gl_FragColor = vec4(col * a * 2.2, a);
}`

const Campfire = memo(function Campfire() {
  const { tex, uRuin } = useWorld()
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useAppear(group, 0.4, 0.62)

  const flameMats = useMemo(
    () =>
      [0, 1].map(
        (i) =>
          new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uSeed: { value: i * 3.7 } },
            vertexShader: flameVertex,
            fragmentShader: flameFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  )

  const smoke = useMemo(() => {
    const n = 16
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const r = rng(17)
    return { g, n, life: Array.from({ length: n }, () => r()), drift: Array.from({ length: n }, () => [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5]) }
  }, [])
  const smokeMat = useMemo(
    () => new THREE.PointsMaterial({ map: tex.soft, color: '#6b645c', size: 2.4, transparent: true, opacity: 0.32, depthWrite: false }),
    [tex],
  )

  const stones: Inst[] = useMemo(() => {
    const r = rng(19)
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return { p: [Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95], r: [r(), r() * 6, r()], s: 0.22 + r() * 0.08 }
    })
  }, [])
  const stoneRef = useRef<THREE.InstancedMesh>(null)
  useInstances(stoneRef, stones)

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    flameMats.forEach((m) => (m.uniforms.uTime.value = t))
    const k = smooth01(0.4, 0.62, uRuin.value)
    if (light.current) light.current.intensity = k * (22 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 4 + Math.sin(t * 23) * 2)
    const pos = smoke.g.attributes.position.array as Float32Array
    for (let i = 0; i < smoke.n; i++) {
      smoke.life[i] += dt * 0.18
      if (smoke.life[i] > 1) smoke.life[i] -= 1
      const l = smoke.life[i]
      pos[i * 3] = smoke.drift[i][0] * l * 4 + Math.sin(t + i) * 0.2
      pos[i * 3 + 1] = 1.2 + l * 7
      pos[i * 3 + 2] = smoke.drift[i][1] * l * 4
    }
    smoke.g.attributes.position.needsUpdate = true
  })

  useEffect(() => () => smoke.g.dispose(), [smoke])

  return (
    <group ref={group} position={[FX, 0, FZ]}>
      <instancedMesh ref={stoneRef} args={[undefined, undefined, stones.length]} receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#6e6862" roughness={0.95} />
      </instancedMesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.18, 0]} rotation={[0, (i * Math.PI) / 4, Math.PI / 2 - 0.35]}>
          <cylinderGeometry args={[0.09, 0.11, 1.3, 6]} />
          <meshStandardMaterial color="#2a1a10" roughness={1} emissive="#5a1a05" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {flameMats.map((m, i) => (
        <mesh key={i} material={m} position={[0, 0.85, 0]} rotation-y={i * (Math.PI / 2)}>
          <planeGeometry args={[1.25, 1.7]} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 1.2, 0]} color="#ff8a3d" distance={18} decay={1.6} intensity={0} />
      <points geometry={smoke.g} material={smokeMat} />
      {CAMPFIRE_SEATS.map((s, i) => (
        <mesh key={i} position={[s.at[0] - FX, 0.22, s.at[2] - FZ]} rotation={[0, s.rotY + Math.PI / 2, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.24, 0.26, 1.7, 8]} />
          <meshStandardMaterial color="#5a4030" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
})

function tinted(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex)
  const out = g.index ? g.toNonIndexed() : g
  if (out.attributes.uv) out.deleteAttribute('uv')
  const n = out.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return out
}

function part(g: THREE.BufferGeometry, hex: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
  g.rotateX(rot[0])
  g.rotateY(rot[1])
  g.rotateZ(rot[2])
  g.translate(...pos)
  return tinted(g, hex)
}

// One merged stall: counter, papers, poles, tarp and crates. Front faces local +x.
function stallGeometry() {
  const poles = [
    [-1.6, -2.2],
    [-1.6, 2.2],
    [1.9, -2.2],
    [1.9, 2.2],
  ].map(([px, pz]) => part(new THREE.CylinderGeometry(0.05, 0.05, px > 0 ? 2.7 : 3.2, 6), '#5c4a38', [px, px > 0 ? 1.35 : 1.6, pz]))
  return mergeGeometries([
    part(new THREE.BoxGeometry(1.0, 1.04, 3.8), '#7a5a3c', [1.2, 0.52, 0]),
    part(new THREE.BoxGeometry(1.15, 0.06, 4.0), '#d9cfb8', [1.2, 1.06, 0]),
    ...[-1.1, -0.2, 0.9].map((dz, i) => part(new THREE.BoxGeometry(0.32, 0.04, 0.42), '#f4efe1', [1.15, 1.12, dz], [0, 0.2 * i, 0])),
    ...poles,
    part(new THREE.BoxGeometry(4.0, 0.05, 4.8), '#3d6f8f', [0.15, 2.95, 0], [0, 0, -0.13]),
    part(new THREE.BoxGeometry(0.7, 0.7, 0.7), '#8a6e4b', [-1.0, 0.35, 1.2]),
    part(new THREE.BoxGeometry(0.55, 0.5, 0.55), '#9c7c55', [-1.0, 0.95, 1.1], [0, 0.4, 0]),
  ])
}

const Tents = memo(function Tents() {
  const { uRuin } = useWorld()
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-1.25, 0)
    s.lineTo(0, 1.65)
    s.lineTo(1.25, 0)
    s.closePath()
    const tent = new THREE.ExtrudeGeometry(s, { depth: 2.8, bevelEnabled: false })
    tent.translate(0, 0, -1.4)
    const door = new THREE.CircleGeometry(0.62, 3)
    door.rotateZ(Math.PI / 2)
    door.translate(0, 0.5, 1.41)
    return { tent, door }
  }, [])
  const mats = useMemo(
    () => ({
      tent: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide }), uRuin, { appear: 'instance' }),
      door: patchRuin(new THREE.MeshStandardMaterial({ color: '#141210' }), uRuin, { appear: 'instance' }),
      depth: ruinDepthMaterial(uRuin, { appear: 'instance' }),
    }),
    [uRuin],
  )
  const items: Inst[] = useMemo(() => tents.map((t, i) => ({ p: [t.x, 0, t.z], r: [0, t.rotY, 0], c: t.color, t: 0.45 + i * 0.03 })), [])
  const tentRef = useRef<THREE.InstancedMesh>(null)
  const doorRef = useRef<THREE.InstancedMesh>(null)
  useInstances(tentRef, items)
  useInstances(doorRef, items)
  useEffect(
    () => () => {
      geo.tent.dispose()
      geo.door.dispose()
    },
    [geo],
  )
  return (
    <group>
      <instancedMesh ref={tentRef} args={[geo.tent, mats.tent, items.length]} castShadow receiveShadow customDepthMaterial={mats.depth} />
      <instancedMesh ref={doorRef} args={[geo.door, mats.door, items.length]} />
    </group>
  )
})

const Banner = memo(function Banner({ map, at, w, h, poleH, rotY = 0 }: { map: THREE.Texture; at: Vec3; w: number; h: number; poleH: number; rotY?: number }) {
  const { uRuin } = useWorld()
  const ref = useRef<THREE.Group>(null)
  useAppear(ref, 0.5, 0.7)
  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, 16, 4), [w, h])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  useFrame(({ clock }) => {
    if (uRuin.value < 0.5) return
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i]
      const sag = 1 - Math.pow((2 * x) / w, 2)
      pos[i + 2] = Math.sin(x * 1.3 + t * 1.8) * 0.12 * sag
      pos[i + 1] = base[i + 1] - sag * 0.12
    }
    geo.attributes.position.needsUpdate = true
  })
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group ref={ref} position={at} rotation-y={rotY}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2 + s * 0.08, poleH / 2, 0]}>
          <cylinderGeometry args={[0.07, 0.09, poleH, 6]} />
          <meshStandardMaterial color="#6b5a46" roughness={0.9} />
        </mesh>
      ))}
      <mesh geometry={geo} position={[0, poleH - h / 2 - 0.25, 0]} castShadow>
        <meshStandardMaterial map={map} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
    </group>
  )
})

const Stalls = memo(function Stalls() {
  const { tex, uRuin } = useWorld()
  const geo = useMemo(stallGeometry, [])
  const mats = useMemo(
    () => ({
      stall: patchRuin(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), uRuin, { appear: 'instance' }),
      depth: ruinDepthMaterial(uRuin, { appear: 'instance' }),
    }),
    [uRuin],
  )
  const items: Inst[] = useMemo(() => STALLS.map((s, i) => ({ p: [s.x, 0, s.z], r: [0, s.rotY, 0], t: 0.48 + i * 0.04 })), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  useInstances(ref, items)
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mats.stall, items.length]} castShadow receiveShadow customDepthMaterial={mats.depth} />
      {STALLS.map((s, i) => (
        <StallSign key={s.key} x={s.x} z={s.z} rotY={s.rotY} map={tex[s.sign]} from={0.5 + i * 0.04} />
      ))}
    </group>
  )
})

const StallSign = memo(function StallSign({ x, z, rotY, map, from }: { x: number; z: number; rotY: number; map: THREE.Texture; from: number }) {
  const ref = useRef<THREE.Group>(null)
  useAppear(ref, from, from + 0.2)
  const dx = Math.cos(rotY) * 1.95
  return (
    <group ref={ref} position={[x + dx, 2.35, z]} rotation-y={rotY + Math.PI / 2}>
      <mesh>
        <planeGeometry args={[3.4, 0.95]} />
        <meshStandardMaterial map={map} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
})

const Assembly = memo(function Assembly() {
  const ref = useRef<THREE.Group>(null)
  useAppear(ref, 0.5, 0.72)
  const [ax, , az] = LANDMARKS.assembly
  return (
    <group ref={ref} position={[ax, 0, az]}>
      {[
        [-1.6, 0.4, 0.2],
        [-0.8, 0.4, 0.4],
        [-1.2, 1.1, 0.3],
      ].map(([x, y, rot], i) => (
        <mesh key={i} position={[x, y, 0.8]} rotation-y={rot} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#8a6e4b" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
})

export const Camp = memo(function Camp() {
  const { tex } = useWorld()
  const [ax, , az] = LANDMARKS.assembly
  return (
    <group>
      <Campfire />
      <Tents />
      <Banner map={tex.bannerExilio} at={[FX, 0, FZ - 7.5]} w={5} h={2.15} poleH={4} />
      <Banner map={tex.bannerParo} at={[ax, 0, az - 1.5]} w={7.8} h={1.55} poleH={4.6} />
      <Assembly />
      <Stalls />
    </group>
  )
})
