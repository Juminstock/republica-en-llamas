import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WorldContext } from '../context'
import { createWorldTextures } from '../textures'
import type { RuinUniform } from '../ruinShader'
import { Lamps } from '../Lamps'
import { Metro } from '../Metro'
import { City } from '../City'
import { StreetProps } from '../Props'
import { Haze, LightShafts } from '../Volumetrics'
import { UdeABuildings } from './Buildings'
import { UdeAGrounds } from './Grounds'
import { Monument } from './Monument'
import { UdeANature } from './Nature'
import { SpeechStage } from './SpeechStage'
import { UdeAWar } from './War'
import { METRO_Z, PLAZOLETA, UDEA_BENCHES, UDEA_BINS, UDEA_LAMPS } from './layout'

type Props = {
  // 0 = the campus before the war, 1 = after it.
  ruin?: number
  ruinRef?: { current: number }
  // The government stage on the theatre steps, for the presidential speech.
  speechStage?: boolean
}

const HAZE_BOUNDS = { minX: PLAZOLETA.minX - 14, maxX: PLAZOLETA.maxX + 10, minZ: PLAZOLETA.minZ - 8, maxZ: PLAZOLETA.maxZ + 30 }
const SHAFT_BOUNDS = { minX: PLAZOLETA.minX, maxX: PLAZOLETA.maxX, minZ: PLAZOLETA.minZ, maxZ: PLAZOLETA.maxZ + 20 }

export function UdeACampus({ ruin = 1, ruinRef, speechStage = false }: Props) {
  const tex = useMemo(createWorldTextures, [])
  const uRuin = useMemo<RuinUniform>(() => ({ value: ruin }), [])
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    const group = root.current
    return () => {
      group?.traverse((o) => {
        const mesh = o as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v instanceof THREE.Texture && v.dispose())
          m.dispose()
        })
      })
      tex.dispose()
    }
  }, [tex])

  uRuin.value = ruinRef ? ruinRef.current : ruin
  useFrame(() => {
    uRuin.value = Math.min(1, Math.max(0, ruinRef ? ruinRef.current : ruin))
  }, -1)

  const ctx = useMemo(() => ({ tex, uRuin }), [tex, uRuin])

  return (
    <WorldContext.Provider value={ctx}>
      <group ref={root}>
        <City minRadius={112} avoidZ={[METRO_Z - 8, METRO_Z + 8]} />
        <UdeAGrounds />
        <UdeABuildings />
        <Monument />
        <UdeANature />
        <UdeAWar />
        <Lamps spots={UDEA_LAMPS} realLights={5} seed={7} />
        <StreetProps benches={UDEA_BENCHES} bins={UDEA_BINS} kiosks={[]} posters={[]} />
        <Metro from={[160, METRO_Z]} to={[-160, METRO_Z]} station={144} stationName="Universidad" stairs={{ at: [16, 79], rotY: Math.PI }} />
        <Haze bounds={HAZE_BOUNDS} seed={9} />
        <LightShafts bounds={SHAFT_BOUNDS} seed={11} />
        {speechStage && <SpeechStage />}
      </group>
    </WorldContext.Provider>
  )
}
