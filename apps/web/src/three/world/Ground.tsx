import { memo, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from './context'
import { PLAZA } from './layout'
import { pbrMaterial } from './pbr'
import { patchWet } from './wet'

const PAVED = { minX: PLAZA.minX - 1.5, maxX: PLAZA.maxX + 2, minZ: -32, maxZ: PLAZA.maxZ + 2 }
// One paver texture covers 3 × 3 slabs of about 1 m.
const PAVER_TILE = 3
// Above 1 on purpose: the paver albedo is a cool mid gray, the plaza stone is warm and pale.
const DRY = new THREE.Color().setRGB(1.42, 1.3, 1.12)

export const Ground = memo(function Ground() {
  const { tex, uRuin } = useWorld()
  const w = PAVED.maxX - PAVED.minX
  const d = PAVED.maxZ - PAVED.minZ
  const cx = (PAVED.minX + PAVED.maxX) / 2
  const cz = (PAVED.minZ + PAVED.maxZ) / 2

  const { asphaltMat, tileMat, overlayMat, curbMat, sidewalkMat } = useMemo(() => {
    const asphaltMat = patchWet(pbrMaterial('asphalt', { repeat: [500 / 5, 500 / 5], color: '#8c8a86' }), 1 / 30)
    const tileMat = patchWet(pbrMaterial('pavers', { repeat: [w / PAVER_TILE, d / PAVER_TILE], color: DRY.clone(), normal: 0.9 }))
    const sidewalkMat = patchWet(pbrMaterial('concreteFloor', { repeat: [8, 1], color: '#cfc7b8' }))
    const ruinMap = tex.ruin.clone()
    ruinMap.repeat.set(w / 22, d / 22)
    ruinMap.needsUpdate = true
    return {
      asphaltMat,
      tileMat,
      sidewalkMat,
      overlayMat: new THREE.MeshStandardMaterial({
        map: ruinMap,
        transparent: true,
        opacity: 0,
        roughness: 1,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      curbMat: pbrMaterial('concrete', { repeat: [20, 0.3], color: '#b8b1a4' }),
    }
  }, [tex, w, d])

  useFrame(() => {
    overlayMat.opacity = Math.min(1, uRuin.value * 1.15)
    tileMat.color.copy(DRY).multiplyScalar(1 - uRuin.value * 0.2)
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow material={asphaltMat}>
        <planeGeometry args={[500, 500]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} receiveShadow material={tileMat}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.012, cz]} receiveShadow material={overlayMat}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* Sidewalks and curbs along the streets */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.005, PAVED.maxZ + 1.6]} receiveShadow material={sidewalkMat}>
        <planeGeometry args={[w + 6, 2.8]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position={[PAVED.maxX + 1.6, 0.005, cz]} receiveShadow material={sidewalkMat}>
        <planeGeometry args={[d, 2.8]} />
      </mesh>
      <mesh position={[cx, 0.06, PAVED.maxZ + 3.1]} material={curbMat} receiveShadow castShadow>
        <boxGeometry args={[w + 6.4, 0.18, 0.3]} />
      </mesh>
      <mesh position={[PAVED.maxX + 3.1, 0.06, cz]} material={curbMat} receiveShadow castShadow>
        <boxGeometry args={[0.3, 0.18, d]} />
      </mesh>
    </group>
  )
})
