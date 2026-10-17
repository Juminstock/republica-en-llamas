import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { WorldContext } from './context'
import { createWorldTextures } from './textures'
import type { RuinUniform } from './ruinShader'
import { Ground } from './Ground'
import { Palacio } from './Palacio'
import { Museo } from './Museo'
import { City } from './City'
import { Vegetation } from './Vegetation'
import { Sculptures } from './Sculptures'
import { Camp } from './Camp'
import { Ruins } from './Ruins'
import { Atmosphere } from './Atmosphere'
import { PlazaDressing } from './plaza/dressing'

type Props = {
  // 0 = pre-war plaza, 1 = six months after the war.
  ruin?: number
  // For per-frame time-lapses without React re-renders: read every frame when provided.
  ruinRef?: { current: number }
}

export function PlazaBotero({ ruin = 1, ruinRef }: Props) {
  const tex = useMemo(createWorldTextures, [])
  const uRuin = useMemo<RuinUniform>(() => ({ value: ruin }), [])
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    const group = root.current
    return () => {
      // Materials own cloned textures; free everything the world created.
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
        <Ground />
        <Palacio />
        <Museo />
        <City />
        <Vegetation />
        <Sculptures />
        <Camp />
        <Ruins />
        <Atmosphere />
        <PlazaDressing />
      </group>
    </WorldContext.Provider>
  )
}
