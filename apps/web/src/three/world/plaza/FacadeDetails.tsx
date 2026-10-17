import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from '../context'
import { MUSEO, PALACIO } from '../layout'
import { meterBox, pbrMaterial } from '../pbr'
import { patchRuin } from '../ruinShader'

const P_FRONT = PALACIO.z + PALACIO.depth / 2
// Window sill heights and cornice bands measured from the painted Palacio bay (1408 px = 22 m).
const P_SILLS = [16.2, 9.8, 2.3]
const P_WIN_W = [1.5, 1.62, 1.88]
const P_BANDS = [21.6, 14.9, 8.5]
const M_EAST = MUSEO.x + MUSEO.width / 2
const M_SILLS = [14.0, 10.6, 7.2, 3.7]

// Relief over the painted facades: sills, drip moldings, cornices, AC units and gutters.
export const FacadeDetails = memo(function FacadeDetails() {
  const { uRuin } = useWorld()
  const geo = useMemo(() => {
    const stone: THREE.BufferGeometry[] = []
    const brick: THREE.BufferGeometry[] = []
    const metal: THREE.BufferGeometry[] = []
    // Palacio: front and both sides
    for (let x = -PALACIO.width / 2 + 2; x < PALACIO.width / 2; x += 4) {
      if (Math.abs(x) < 7.5) continue
      P_SILLS.forEach((y, i) => {
        stone.push(meterBox(P_WIN_W[i] + 0.4, 0.16, 0.32, 1).translate(x, y - 0.08, P_FRONT + 0.14))
        stone.push(meterBox(P_WIN_W[i] + 0.25, 0.12, 0.2, 1).translate(x, y + [3.75, 4.05, 5.15][i], P_FRONT + 0.08))
      })
    }
    for (const sx of [-1, 1])
      for (let z = PALACIO.z - PALACIO.depth / 2 + 2; z < P_FRONT; z += 4)
        P_SILLS.forEach((y, i) => stone.push(meterBox(0.32, 0.16, P_WIN_W[i] + 0.4, 1).translate(sx * (PALACIO.width / 2 + 0.14), y - 0.08, z)))
    P_BANDS.forEach((y, i) => {
      const depth = i === 0 ? 0.55 : 0.32
      stone.push(meterBox(PALACIO.width + 0.6, i === 0 ? 0.5 : 0.24, depth, 2).translate(0, y, P_FRONT + depth / 2 - 0.02))
      for (const sx of [-1, 1]) stone.push(meterBox(depth, i === 0 ? 0.5 : 0.24, PALACIO.depth, 2).translate(sx * (PALACIO.width / 2 + depth / 2 - 0.02), y, PALACIO.z))
    })
    // Museo: east facade
    for (let z = MUSEO.z - MUSEO.depth / 2 + 2; z < MUSEO.z + MUSEO.depth / 2; z += 4) {
      if (Math.abs(z - MUSEO.z) < 4.5) continue
      M_SILLS.forEach((y, i) => {
        brick.push(meterBox(0.3, 0.14, 1.9, 1).translate(M_EAST + 0.12, y - 0.07, z))
        if (i % 2 === 0 && Math.abs(z * 7 + y) % 3 < 1) metal.push(meterBox(0.55, 0.45, 0.8, 1).translate(M_EAST + 0.32, y + 0.25, z + 0.9))
      })
    }
    brick.push(meterBox(0.6, 0.3, MUSEO.depth + 0.4, 2).translate(M_EAST + 0.2, 4.9, MUSEO.z))
    metal.push(new THREE.CylinderGeometry(0.07, 0.07, MUSEO.height, 6).translate(M_EAST + 0.15, MUSEO.height / 2, MUSEO.z - MUSEO.depth / 2 + 0.4))
    metal.push(new THREE.CylinderGeometry(0.07, 0.07, MUSEO.height, 6).translate(M_EAST + 0.15, MUSEO.height / 2, MUSEO.z + MUSEO.depth / 2 - 0.4))
    return { stone: mergeGeometries(stone), brick: mergeGeometries(brick), metal: mergeGeometries(metal.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g })) }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(
    () => ({
      stone: patchRuin(pbrMaterial('plaster', { color: '#e8e2d4' }), uRuin, { tint: { color: '#4a433d', amount: 0.35 } }),
      brick: patchRuin(pbrMaterial('plaster', { color: '#d6bf98' }), uRuin, { tint: { color: '#3f2f28', amount: 0.3 } }),
      metal: patchRuin(new THREE.MeshStandardMaterial({ color: '#c7c9c8', metalness: 0.5, roughness: 0.5 }), uRuin, { tint: { color: '#4a3020', amount: 0.55 } }),
    }),
    [uRuin],
  )

  return (
    <group>
      <mesh geometry={geo.stone} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={geo.brick} material={mats.brick} castShadow receiveShadow />
      <mesh geometry={geo.metal} material={mats.metal} castShadow />
    </group>
  )
})
