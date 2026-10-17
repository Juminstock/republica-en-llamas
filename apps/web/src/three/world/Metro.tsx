import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { meterBox, pbrMaterial } from './pbr'
import { patchRuin } from './ruinShader'
import { textTexture } from './textures'

type V2 = [number, number]

const DECK_Y = 10
const DECK_W = 9
const PIER_EVERY = 24

// Medellín's elevated Metro: concrete viaduct on piers, a station box, stairs down to the street and a parked train.
export const Metro = memo(function Metro({ from, to, station, stationName, stairs }: { from: V2; to: V2; station?: number; stationName?: string; stairs?: { at: V2; rotY: number } }) {
  const { uRuin } = useWorld()
  const dir = new THREE.Vector2(to[0] - from[0], to[1] - from[1])
  const length = dir.length()
  const yaw = Math.atan2(dir.x, dir.y)
  const mid: V2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]

  const geo = useMemo(() => {
    const piers: THREE.BufferGeometry[] = []
    for (let d = -length / 2 + 6; d < length / 2; d += PIER_EVERY) {
      const p = meterBox(2.2, DECK_Y, 2.2, 2)
      p.translate(0, DECK_Y / 2, d)
      piers.push(p)
      const cap = meterBox(DECK_W - 1, 1.2, 2.6, 2)
      cap.translate(0, DECK_Y - 0.6, d)
      piers.push(cap)
    }
    const deck = meterBox(DECK_W, 1.6, length, 2)
    deck.translate(0, DECK_Y + 0.8, 0)
    const parapets = [-1, 1].map((s) => meterBox(0.3, 1.1, length, 2).translate((s * DECK_W) / 2, DECK_Y + 2.15, 0))
    return { concrete: mergeGeometries([...piers, deck, ...parapets]) }
  }, [length])
  useEffect(() => () => geo.concrete.dispose(), [geo])

  const mats = useMemo(() => {
    const soot = { tint: { color: '#3a3532', amount: 0.4 } }
    return {
      concrete: patchRuin(pbrMaterial('concrete', { color: '#c9c3b8' }), uRuin, soot),
      train: patchRuin(new THREE.MeshStandardMaterial({ color: '#d8dadc', metalness: 0.55, roughness: 0.35 }), uRuin, { tint: { color: '#4a3b30', amount: 0.6 } }),
      stripe: new THREE.MeshStandardMaterial({ color: '#6aa84f', roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: '#1b2630', metalness: 0.6, roughness: 0.15 }),
      roof: patchRuin(new THREE.MeshStandardMaterial({ color: '#8f9498', metalness: 0.6, roughness: 0.45 }), uRuin, soot),
      sign: stationName ? new THREE.MeshStandardMaterial({ map: textTexture(['METRO', stationName.toUpperCase()], { w: 512, h: 160, bg: '#2f6e3a', fg: '#ffffff' }), emissive: '#ffffff', emissiveIntensity: 0.15 }) : null,
    }
  }, [uRuin, stationName])

  const stationLen = 46
  const trainLen = 52

  return (
    <group>
      <group position={[mid[0], 0, mid[1]]} rotation-y={yaw}>
        <mesh geometry={geo.concrete} material={mats.concrete} castShadow receiveShadow />
        {/* Train parked on one track */}
        <group position={[-2, DECK_Y + 1.6, (station ?? 0) - length / 2 + 4]}>
          {[0, 1, 2].map((k) => (
            <group key={k} position={[0, 0, k * (trainLen / 3) - trainLen / 3]}>
              <mesh material={mats.train} position={[0, 1.7, 0]} castShadow>
                <boxGeometry args={[2.9, 3.3, trainLen / 3 - 0.6]} />
              </mesh>
              <mesh material={mats.glass} position={[0, 2.3, 0]}>
                <boxGeometry args={[2.95, 0.9, trainLen / 3 - 1.4]} />
              </mesh>
              <mesh material={mats.stripe} position={[0, 1.1, 0]}>
                <boxGeometry args={[2.96, 0.25, trainLen / 3 - 0.8]} />
              </mesh>
            </group>
          ))}
        </group>
        {station !== undefined && (
          <group position={[0, 0, station - length / 2]}>
            <mesh material={mats.roof} position={[0, DECK_Y + 7, 0]} castShadow>
              <boxGeometry args={[DECK_W + 6, 0.5, stationLen]} />
            </mesh>
            {[-1, 1].map((s) =>
              [-18, -6, 6, 18].map((z) => (
                <mesh key={`${s}${z}`} material={mats.roof} position={[(s * (DECK_W + 5)) / 2, DECK_Y + 4.2, z]}>
                  <boxGeometry args={[0.3, 5.6, 0.3]} />
                </mesh>
              )),
            )}
            <mesh material={mats.concrete} position={[0, DECK_Y + 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[DECK_W + 6, 1, stationLen]} />
            </mesh>
            {mats.sign && (
              <mesh material={mats.sign} position={[-(DECK_W + 6) / 2 - 0.05, DECK_Y + 5.6, 0]} rotation-y={-Math.PI / 2}>
                <planeGeometry args={[7, 2.2]} />
              </mesh>
            )}
          </group>
        )}
      </group>
      {stairs && <Stairs at={stairs.at} rotY={stairs.rotY} material={mats.concrete} rail={mats.roof} />}
    </group>
  )
})

// A covered stair run climbing from the street up to the station level.
const Stairs = memo(function Stairs({ at, rotY, material, rail }: { at: V2; rotY: number; material: THREE.Material; rail: THREE.Material }) {
  const steps = 26
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < steps; i++) {
      const g = meterBox(3, 0.38 * (i + 1), 0.42, 1)
      g.translate(0, (0.38 * (i + 1)) / 2, -i * 0.42)
      parts.push(g)
    }
    return mergeGeometries(parts)
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={rotY}>
      <mesh geometry={geo} material={material} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} material={rail} position={[s * 1.6, 5.9, -5.4]} rotation-x={-Math.atan2(0.38, 0.42)}>
          <boxGeometry args={[0.08, 0.08, 15.2]} />
        </mesh>
      ))}
    </group>
  )
})
