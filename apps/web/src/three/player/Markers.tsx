import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { InteractionPoint } from '../world/locations'
import { useGame } from '../../features/session/gameStore'

const gold = new THREE.MeshStandardMaterial({ color: '#f2b705', emissive: '#f2b705', emissiveIntensity: 2.2, roughness: 0.3 })
const ringMat = new THREE.MeshBasicMaterial({ color: '#f2b705', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
const diamond = new THREE.OctahedronGeometry(0.22, 0)
const ring = new THREE.RingGeometry(0.75, 0.9, 40)

// Objective markers: a floating golden diamond and a pulsing ring on the ground.
export function Markers({ interactions }: { interactions: InteractionPoint[] }) {
  const stamps = useGame((s) => s.stamps)
  const allStamps = ['biblioteca', 'bienestar', 'tesoreria', 'asamblea'].every((s) => stamps.includes(s))

  return (
    <>
      {interactions.map((it) => {
        const done = it.id.startsWith('metro-') || it.id === 'rectoria' ? false : stamps.includes(it.id)
        if (done) return null
        // The rector only matters once the other four are done.
        const dim = it.id === 'rectoria' && !allStamps
        return <Marker key={it.id} at={it.at} dim={dim} />
      })}
    </>
  )
}

function Marker({ at, dim }: { at: [number, number, number]; dim: boolean }) {
  const d = useRef<THREE.Mesh>(null)
  const r = useRef<THREE.Mesh>(null)
  const phase = useRef(Math.random() * 10)
  useFrame((_, dt) => {
    phase.current += dt
    const t = phase.current
    if (d.current) {
      d.current.position.y = 2.7 + Math.sin(t * 2.2) * 0.12
      d.current.rotation.y += dt * 1.6
      d.current.scale.setScalar(dim ? 0.6 : 1)
    }
    if (r.current) {
      const k = (t * 0.6) % 1
      r.current.scale.setScalar(0.8 + k * 0.7)
      ;(r.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (dim ? 0.15 : 0.5)
    }
  })
  return (
    <group position={[at[0], 0, at[2]]}>
      <mesh ref={d} geometry={diamond} material={gold} />
      <mesh ref={r} geometry={ring} material={ringMat.clone()} rotation-x={-Math.PI / 2} position-y={0.03} />
    </group>
  )
}
