import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type WarHandle = {
  explode: (at: THREE.Vector3, size?: number) => void
  flyover: (from: THREE.Vector3, to: THREE.Vector3, seconds: number) => void
}

const MAX_BLASTS = 10
const fireTex = makeRadialTexture(['rgba(255,250,220,1)', 'rgba(255,170,60,0.9)', 'rgba(200,60,20,0.45)', 'rgba(40,20,10,0)'])
const smokeTex = makeRadialTexture(['rgba(70,64,60,0.85)', 'rgba(50,46,44,0.5)', 'rgba(30,30,30,0)'])

const UP_FLASH = new THREE.Vector3(0, 6, 0)
const rise = new THREE.Vector3()

type Blast = { active: boolean; t: number; size: number; pos: THREE.Vector3 }
type Jet = { active: boolean; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3 }

// Explosions on the skyline and fighter jets crossing the sky, driven by the intro director.
export const War = forwardRef<WarHandle>(function War(_, ref) {
  const blasts = useMemo<Blast[]>(() => Array.from({ length: MAX_BLASTS }, () => ({ active: false, t: 0, size: 1, pos: new THREE.Vector3() })), [])
  const jets = useMemo<Jet[]>(() => Array.from({ length: 4 }, () => ({ active: false, t: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3() })), [])
  const fireRefs = useRef<(THREE.Sprite | null)[]>([])
  const smokeRefs = useRef<(THREE.Sprite | null)[]>([])
  const jetRefs = useRef<(THREE.Group | null)[]>([])
  const light = useRef<THREE.PointLight>(null)

  useImperativeHandle(ref, () => ({
    explode(at, size = 1) {
      const b = blasts.find((x) => !x.active) ?? blasts[0]
      b.active = true
      b.t = 0
      b.size = size
      b.pos.copy(at)
    },
    flyover(from, to, seconds) {
      const j = jets.find((x) => !x.active) ?? jets[0]
      j.active = true
      j.t = 0
      j.dur = seconds
      j.from.copy(from)
      j.to.copy(to)
    },
  }))

  useFrame((_, dt) => {
    let flash = 0
    let flashPos: THREE.Vector3 | null = null
    blasts.forEach((b, i) => {
      const fire = fireRefs.current[i]
      const smoke = smokeRefs.current[i]
      if (!fire || !smoke) return
      if (!b.active) {
        fire.visible = smoke.visible = false
        return
      }
      b.t += dt
      const k = b.t
      fire.visible = k < 1.4
      smoke.visible = true
      fire.position.copy(b.pos)
      fire.scale.setScalar(b.size * (6 + k * 14))
      ;(fire.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k / 1.4)
      smoke.position.copy(b.pos).add(rise.set(0, k * 6 * b.size, 0))
      smoke.scale.setScalar(b.size * (8 + k * 10))
      ;(smoke.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.8 - k / 6)
      if (k < 0.6 && (1 - k / 0.6) * b.size > flash) {
        flash = (1 - k / 0.6) * b.size
        flashPos = b.pos
      }
      if (k > 6) b.active = false
    })
    if (light.current) {
      light.current.intensity = flash * 4000
      if (flashPos) light.current.position.copy(flashPos).add(UP_FLASH)
    }
    jets.forEach((j, i) => {
      const g = jetRefs.current[i]
      if (!g) return
      if (!j.active) {
        g.visible = false
        return
      }
      j.t += dt
      const k = j.t / j.dur
      g.visible = k < 1
      g.position.lerpVectors(j.from, j.to, k)
      g.lookAt(j.to)
      if (k >= 1) j.active = false
    })
  })

  return (
    <>
      <pointLight ref={light} color="#ffb060" intensity={0} distance={260} decay={1.4} />
      {blasts.map((_, i) => (
        <group key={i}>
          <sprite ref={(el) => (smokeRefs.current[i] = el)} visible={false}>
            <spriteMaterial map={smokeTex} transparent depthWrite={false} opacity={0} />
          </sprite>
          <sprite ref={(el) => (fireRefs.current[i] = el)} visible={false}>
            <spriteMaterial map={fireTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} color="#ffffff" />
          </sprite>
        </group>
      ))}
      {jets.map((_, i) => (
        <group key={i} ref={(el) => (jetRefs.current[i] = el)} visible={false}>
          <JetMesh />
        </group>
      ))}
    </>
  )
})

const jetMat = new THREE.MeshStandardMaterial({ color: '#59626b', metalness: 0.6, roughness: 0.45 })
const trailMat = new THREE.MeshBasicMaterial({ color: '#e8e6e0', transparent: true, opacity: 0.35, depthWrite: false })

function JetMesh() {
  return (
    <group scale={1.6}>
      <mesh material={jetMat} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.7, 9, 8]} />
      </mesh>
      <mesh material={jetMat} position={[0, 0, -1]}>
        <boxGeometry args={[9, 0.15, 2.6]} />
      </mesh>
      <mesh material={jetMat} position={[0, 1, -3.6]}>
        <boxGeometry args={[0.15, 2.2, 1.6]} />
      </mesh>
      <mesh material={jetMat} position={[0, 0, -3.8]}>
        <boxGeometry args={[3.6, 0.12, 1.2]} />
      </mesh>
      {[-3.6, 3.6].map((x) => (
        <mesh key={x} material={trailMat} position={[x, 0, -22]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.12, 0.5, 36, 6, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

function makeRadialTexture(stops: string[]) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
