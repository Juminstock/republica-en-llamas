import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from './context'
import { PALACIO, LANDMARKS } from './layout'
import { patchRuin } from './ruinShader'
import { useInstances } from './instancing'
import { pbrMaps } from './pbr'

const FRONT_Z = PALACIO.z + PALACIO.depth / 2
const H = PALACIO.height
const SOOT = { color: '#4a433d', amount: 0.38 }
const TOWERS = [
  [-PALACIO.width / 2 + 1, FRONT_Z - 2],
  [PALACIO.width / 2 - 1, FRONT_Z - 2],
  [-PALACIO.width / 2 + 1, PALACIO.z - PALACIO.depth / 2 + 2],
  [PALACIO.width / 2 - 1, PALACIO.z - PALACIO.depth / 2 + 2],
]

function archShape(w: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(-w / 2, h - w * 0.55)
  s.quadraticCurveTo(-w / 2, h - w * 0.12, 0, h)
  s.quadraticCurveTo(w / 2, h - w * 0.12, w / 2, h - w * 0.55)
  s.lineTo(w / 2, 0)
  s.closePath()
  return s
}

export const Palacio = memo(function Palacio() {
  const { tex, uRuin } = useWorld()

  const m = useMemo(() => {
    const bay = (t: THREE.Texture, rx: number) => {
      const c = t.clone()
      c.repeat.set(rx, 1)
      c.needsUpdate = true
      return c
    }
    const stripe = (rx: number, ry: number, base = tex.towerStripes) => {
      const c = base.clone()
      c.repeat.set(rx, ry)
      c.needsUpdate = true
      return c
    }
    // Stone relief from the plaster PBR set under the painted stripes.
    const relief = pbrMaps('plaster', [14, 7])
    const std = (o: THREE.MeshStandardMaterialParameters) =>
      patchRuin(
        new THREE.MeshStandardMaterial({ roughness: 0.95, normalMap: relief.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: relief.arm, ...o }),
        uRuin,
        { tint: SOOT },
      )
    const roof = std({ color: '#34363b', roughness: 0.9 })
    const front = std({ map: bay(tex.palacio, PALACIO.width / 4) })
    const side = std({ map: bay(tex.palacioSide, PALACIO.depth / 4) })
    const pav = std({ map: bay(tex.palacio, 3.5) })
    return {
      body: [side, side, roof, roof, front, front],
      pavilion: [pav, pav, roof, roof, pav, pav],
      tower: std({ map: stripe(1.5, 1) }),
      drum: std({ map: stripe(10, 0.2) }),
      dome: std({ map: stripe(12, 1, tex.domeStripes), roughness: 0.55, metalness: 0.15 }),
      slate: std({ color: '#2a2b30', roughness: 0.7 }),
      stone: std({ color: '#dcd6c8' }),
      glass: new THREE.MeshStandardMaterial({ color: '#1a2128', roughness: 0.25, metalness: 0.4 }),
      wood: std({ color: '#3a2618', roughness: 0.85 }),
      rail: std({ color: '#e6e1d5' }),
    }
  }, [tex, uRuin])

  const gable = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-7, 0)
    s.lineTo(0, 6.5)
    s.lineTo(7, 0)
    s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false })
  }, [])
  const door = useMemo(() => new THREE.ShapeGeometry(archShape(4, 6.4)), [])
  const balconyDoor = useMemo(() => new THREE.ShapeGeometry(archShape(2.2, 3.3)), [])

  const pinnacles = useRef<THREE.InstancedMesh>(null)
  const pinnacleSpots = useMemo(() => {
    const spots: [number, number, number, number][] = []
    for (let x = -16; x <= 16; x += 4) if (Math.abs(x) > 7) spots.push([x, H, FRONT_Z - 0.4, 1])
    for (let x = -16; x <= 16; x += 4) spots.push([x, H, PALACIO.z - PALACIO.depth / 2 + 0.4, 1])
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      spots.push([Math.cos(a) * 6.9, H + 5, PALACIO.z + Math.sin(a) * 6.9, 0.7])
    }
    for (const sx of [-1, 1]) for (const sz of [FRONT_Z - 1, PALACIO.z - PALACIO.depth / 2 + 1]) {
      spots.push([sx * 18.6, H + 5, sz, 0.9], [sx * 23.4, H + 5, sz, 0.9])
    }
    spots.push([-7, H + 6.2, FRONT_Z + 0.4, 1.1], [7, H + 6.2, FRONT_Z + 0.4, 1.1], [0, H + 12.7, FRONT_Z + 0.4, 1.4])
    for (const [x, z] of TOWERS) spots.push([x, H + 11.2, z, 0.8])
    return spots
  }, [])

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    pinnacleSpots.forEach(([x, y, z, s], i) => {
      o.position.set(x, y + 1.2 * s, z)
      o.scale.setScalar(s)
      o.updateMatrix()
      pinnacles.current!.setMatrixAt(i, o.matrix)
    })
    pinnacles.current!.instanceMatrix.needsUpdate = true
  }, [pinnacleSpots])

  const towerRef = useRef<THREE.InstancedMesh>(null)
  const roofRef = useRef<THREE.InstancedMesh>(null)
  useInstances(towerRef, useMemo(() => TOWERS.map(([x, z]) => ({ p: [x, (H + 5) / 2, z] })), []))
  useInstances(roofRef, useMemo(() => TOWERS.map(([x, z]) => ({ p: [x, H + 5 + 3.2, z], r: [0, Math.PI / 4, 0] })), []))

  return (
    <group>
      <mesh position={[PALACIO.x, H / 2, PALACIO.z]} material={m.body} castShadow receiveShadow>
        <boxGeometry args={[PALACIO.width, H, PALACIO.depth]} />
      </mesh>
      {/* Central pavilion with gable and rose window */}
      <mesh position={[0, (H + 6) / 2, PALACIO.z + 0.15]} material={m.pavilion} castShadow receiveShadow>
        <boxGeometry args={[14, H + 6, PALACIO.depth + 0.3]} />
      </mesh>
      <mesh geometry={gable} position={[0, H + 6, FRONT_Z - 1.05]} material={m.drum} castShadow />
      <mesh position={[0, H + 2.6, FRONT_Z + 0.2]} material={m.stone}>
        <circleGeometry args={[2.1, 32]} />
      </mesh>
      <mesh position={[0, H + 2.6, FRONT_Z + 0.22]} material={m.glass}>
        <circleGeometry args={[1.7, 32]} />
      </mesh>
      <instancedMesh ref={towerRef} args={[undefined, m.tower, TOWERS.length]} castShadow receiveShadow>
        <boxGeometry args={[6, H + 5, 6]} />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, m.slate, TOWERS.length]} castShadow>
        <coneGeometry args={[4.4, 6.4, 4]} />
      </instancedMesh>
      {/* Dome */}
      <group position={[0, H, PALACIO.z]}>
        <mesh position={[0, 2.6, 0]} material={m.drum} castShadow>
          <cylinderGeometry args={[6.5, 6.7, 5.2, 40]} />
        </mesh>
        <mesh position={[0, 5.2, 0]} scale={[1, 1.22, 1]} material={m.dome} castShadow>
          <sphereGeometry args={[6.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 13.9, 0]} material={m.stone} castShadow>
          <cylinderGeometry args={[1.0, 1.1, 1.8, 12]} />
        </mesh>
        <mesh position={[0, 15.4, 0]} material={m.slate}>
          <coneGeometry args={[1.3, 2.6, 12]} />
        </mesh>
      </group>
      <instancedMesh ref={pinnacles} args={[undefined, undefined, pinnacleSpots.length]} material={m.slate}>
        <coneGeometry args={[0.38, 2.4, 6]} />
      </instancedMesh>
      {/* Main door portal */}
      <mesh position={[0, 3.8, FRONT_Z + 0.2]} material={m.stone} castShadow receiveShadow>
        <boxGeometry args={[6.4, 7.6, 0.4]} />
      </mesh>
      <mesh geometry={door} position={[0, 0, LANDMARKS.palacioDoor[2] - 0.38]} material={m.wood} />
      {/* Balcony */}
      <group position={[0, LANDMARKS.balcony[1], FRONT_Z]}>
        <mesh position={[0, -0.18, 0.95]} material={m.stone} castShadow receiveShadow>
          <boxGeometry args={[8, 0.36, 1.9]} />
        </mesh>
        {[-3, 0, 3].map((x) => (
          <mesh key={x} position={[x, -0.7, 0.7]} material={m.stone}>
            <boxGeometry args={[0.5, 0.7, 1.2]} />
          </mesh>
        ))}
        <mesh position={[0, 1.05, 1.82]} material={m.rail}>
          <boxGeometry args={[8, 0.12, 0.16]} />
        </mesh>
        <Balusters material={m.rail} />
        <mesh geometry={balconyDoor} position={[0, 0, 0.16]} material={m.glass} />
        <Flag x={-3.7} side={-1} />
        <Flag x={3.7} side={1} />
      </group>
    </group>
  )
})

const Balusters = memo(function Balusters({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = 22
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      o.position.set(-3.85 + (i / (n - 1)) * 7.7, 0.5, 1.82)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={material}>
      <cylinderGeometry args={[0.06, 0.08, 1, 6]} />
    </instancedMesh>
  )
})

const FLAG_W = 1.9
const FLAG_H = 1.25

const Flag = memo(function Flag({ x, side }: { x: number; side: number }) {
  const { tex, uRuin } = useWorld()
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 18, 10)
    g.translate(FLAG_W / 2, 0, 0)
    return g
  }, [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex.flag,
        alphaMap: tex.tatter,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        roughness: 0.9,
      }),
    [tex],
  )
  const burnt = useMemo(() => new THREE.Color('#5b4a3a'), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array as Float32Array
    const ruin = uRuin.value
    for (let i = 0; i < pos.length; i += 3) {
      const px = base[i]
      const py = base[i + 1]
      const k = px / FLAG_W
      pos[i + 2] = Math.sin(px * 3.1 - t * 4.2 + py * 0.8) * 0.16 * k + Math.sin(px * 7 - t * 7) * 0.03 * k
      pos[i + 1] = py - k * k * 0.18 * (0.4 + ruin)
    }
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
    mat.alphaTest = 0.05 + ruin * 0.55
    mat.color.copy(white).lerp(burnt, ruin * 0.65)
  })

  return (
    <group position={[x, 0, 1.75]}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 4, 6]} />
        <meshStandardMaterial color="#c9c4b5" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={geo} material={mat} position={[0, 3.3, 0]} rotation-y={side > 0 ? 0 : Math.PI} />
    </group>
  )
})
