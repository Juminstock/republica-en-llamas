import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useWorld } from './context'
import { MUSEO } from './layout'
import { patchRuin } from './ruinShader'
import { pbrMaps } from './pbr'

const EAST_X = MUSEO.x + MUSEO.width / 2
const SOOT = { color: '#3f2f28', amount: 0.32 }

export const Museo = memo(function Museo() {
  const { tex, uRuin } = useWorld()

  const m = useMemo(() => {
    const bay = (t: THREE.Texture, rx: number) => {
      const c = t.clone()
      c.repeat.set(rx, 1)
      c.needsUpdate = true
      return c
    }
    const relief = pbrMaps('concrete', [12, 6])
    const std = (o: THREE.MeshStandardMaterialParameters) =>
      patchRuin(
        new THREE.MeshStandardMaterial({ roughness: 1, normalMap: relief.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: relief.arm, ...o }),
        uRuin,
        { tint: SOOT },
      )
    const long = std({ map: bay(tex.brick, MUSEO.depth / 4) })
    const short = std({ map: bay(tex.brickSide, MUSEO.width / 4) })
    const roof = std({ color: '#6b3a2a', roughness: 0.95 })
    const brickTop = std({ map: bay(tex.brickSide, 2.5) })
    return {
      body: [long, long, roof, roof, short, short],
      tier: [brickTop, brickTop, roof, roof, brickTop, brickTop],
      stone: std({ color: '#d9c3a0' }),
      dark: new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: 0.6 }),
      banner1: new THREE.MeshStandardMaterial({ map: tex.museoBanner1, side: THREE.DoubleSide, roughness: 0.9 }),
      banner2: new THREE.MeshStandardMaterial({ map: tex.museoBanner2, side: THREE.DoubleSide, roughness: 0.9 }),
    }
  }, [tex, uRuin])

  const pilasters = useRef<THREE.InstancedMesh>(null)
  const pilasterZ = useMemo(() => {
    const zs: number[] = []
    for (let z = MUSEO.z - MUSEO.depth / 2 + 2; z <= MUSEO.z + MUSEO.depth / 2 - 2; z += 4) zs.push(z)
    return zs
  }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    pilasterZ.forEach((z, i) => {
      o.position.set(EAST_X + 0.18, MUSEO.height / 2 + 0.4, z)
      o.updateMatrix()
      pilasters.current!.setMatrixAt(i, o.matrix)
    })
    pilasters.current!.instanceMatrix.needsUpdate = true
  }, [pilasterZ])

  return (
    <group>
      <mesh position={[MUSEO.x, MUSEO.height / 2, MUSEO.z]} material={m.body} castShadow receiveShadow>
        <boxGeometry args={[MUSEO.width, MUSEO.height, MUSEO.depth]} />
      </mesh>
      {/* Art deco setbacks over the entrance */}
      <mesh position={[MUSEO.x + 3, MUSEO.height + 2.5, MUSEO.z]} material={m.tier} castShadow>
        <boxGeometry args={[14, 5, 12]} />
      </mesh>
      <mesh position={[MUSEO.x + 4, MUSEO.height + 6.5, MUSEO.z]} material={m.tier} castShadow>
        <boxGeometry args={[9, 3, 7]} />
      </mesh>
      <mesh position={[EAST_X, MUSEO.height + 0.4, MUSEO.z]} material={m.stone} castShadow>
        <boxGeometry args={[0.8, 0.8, MUSEO.depth + 0.6]} />
      </mesh>
      <instancedMesh ref={pilasters} args={[undefined, undefined, pilasterZ.length]} material={m.stone} castShadow receiveShadow>
        <boxGeometry args={[0.4, MUSEO.height + 0.8, 0.55]} />
      </instancedMesh>
      {/* Entrance */}
      <mesh position={[EAST_X + 0.3, 3, MUSEO.z]} material={m.stone} castShadow receiveShadow>
        <boxGeometry args={[0.6, 6, 7.2]} />
      </mesh>
      <mesh position={[EAST_X + 0.62, 2.6, MUSEO.z]} rotation-y={Math.PI / 2} material={m.dark}>
        <planeGeometry args={[5, 5.2]} />
      </mesh>
      <mesh position={[EAST_X + 1.6, 6.2, MUSEO.z]} material={m.stone} castShadow>
        <boxGeometry args={[3, 0.3, 8]} />
      </mesh>
      <mesh position={[EAST_X + 0.35, 10.5, MUSEO.z - 9]} rotation-y={Math.PI / 2} material={m.banner1}>
        <planeGeometry args={[1.7, 5.4]} />
      </mesh>
      <mesh position={[EAST_X + 0.35, 10.5, MUSEO.z + 9]} rotation-y={Math.PI / 2} material={m.banner2}>
        <planeGeometry args={[1.7, 5.4]} />
      </mesh>
    </group>
  )
})
