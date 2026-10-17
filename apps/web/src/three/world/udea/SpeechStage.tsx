import { memo, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from '../context'
import { textTexture } from '../textures'
import { UDEA_LANDMARKS } from './layout'

const [PX, PY, PZ] = UDEA_LANDMARKS.podium

// The government's stage on the theatre steps for the presidential speech at the UdeA.
export const SpeechStage = memo(function SpeechStage() {
  const { tex } = useWorld()
  const mats = useMemo(
    () => ({
      skirt: new THREE.MeshStandardMaterial({ color: '#16213a', roughness: 0.6 }),
      carpet: new THREE.MeshStandardMaterial({ color: '#7a1420', roughness: 0.9 }),
      wood: new THREE.MeshPhysicalMaterial({ color: '#4a2c1a', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c9a443', metalness: 0.85, roughness: 0.3 }),
      black: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.5, metalness: 0.3 }),
      backdrop: new THREE.MeshStandardMaterial({
        map: textTexture(['GOBIERNO NACIONAL', 'ORDEN · SEGURIDAD · DECRETOS'], { w: 1024, h: 260, bg: '#1b2b4f', fg: '#f4efe1' }),
        roughness: 0.7,
        emissive: '#ffffff',
        emissiveIntensity: 0.06,
      }),
      pole: new THREE.MeshStandardMaterial({ color: '#d8d4c8', metalness: 0.7, roughness: 0.35 }),
    }),
    [],
  )

  return (
    <group>
      <mesh material={mats.skirt} position={[PX, PY / 2, PZ]} castShadow receiveShadow>
        <boxGeometry args={[13, PY, 5.4]} />
      </mesh>
      <mesh material={mats.carpet} position={[PX, PY + 0.01, PZ + 0.2]} receiveShadow>
        <boxGeometry args={[2.2, 0.02, 5]} />
      </mesh>
      {/* Lectern with emblem and microphones */}
      <group position={[PX, PY, PZ + 0.55]}>
        <mesh material={mats.wood} position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.9, 1.1, 0.55]} />
        </mesh>
        <mesh material={mats.wood} position={[0, 1.14, -0.08]} rotation-x={-0.35} castShadow>
          <boxGeometry args={[1.0, 0.06, 0.6]} />
        </mesh>
        <mesh material={mats.gold} position={[0, 0.62, 0.28]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 24]} />
        </mesh>
        {[-0.12, 0.12].map((x) => (
          <group key={x} position={[x, 1.2, 0.05]} rotation-x={-0.5}>
            <mesh material={mats.black} position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.34, 6]} />
            </mesh>
            <mesh material={mats.black} position={[0, 0.34, 0]}>
              <sphereGeometry args={[0.03, 10, 8]} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh material={mats.backdrop} position={[PX, PY + 2.6, PZ - 2.45]} castShadow>
        <boxGeometry args={[11, 2.8, 0.12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={mats.black} position={[PX + s * 5.6, PY + 0.7, PZ - 1.5]} castShadow>
            <boxGeometry args={[0.7, 1.4, 0.6]} />
          </mesh>
          <StageFlag x={PX + s * 3.6} z={PZ - 1.9} y={PY} map={tex.flag} pole={mats.pole} />
        </group>
      ))}
    </group>
  )
})

const FW = 1.6
const FH = 1.05

const StageFlag = memo(function StageFlag({ x, y, z, map, pole }: { x: number; y: number; z: number; map: THREE.Texture; pole: THREE.Material }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(FW, FH, 14, 8).translate(FW / 2, 0, 0), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.85 }), [map])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      const k = base[i] / FW
      pos[i + 2] = Math.sin(base[i] * 3 - t * 3.4 + x) * 0.12 * k
      pos[i + 1] = base[i + 1] - k * k * 0.12
    }
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <group position={[x, y, z]}>
      <mesh material={pole} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 3.2, 8]} />
      </mesh>
      <mesh geometry={geo} material={mat} position={[0, 2.65, 0]} />
    </group>
  )
})
