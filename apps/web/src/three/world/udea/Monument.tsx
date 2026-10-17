import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from '../context'
import { pbrMaps, pbrMaterial } from '../pbr'
import { patchRuin } from '../ruinShader'
import { crescentHull } from './geometry'
import { MONUMENT } from './layout'

const COLUMN_H = 15

function limb(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, a.distanceTo(b)), 6, 12)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))
  const m = a.clone().add(b).multiplyScalar(0.5)
  return g.translate(m.x, m.y, m.z).toNonIndexed()
}

// A tall monument to human energy in the campus' spirit: a hull-like base, a faceted rising column
// and a figure lifting rings to the sky. Generic, not a replica.
export const Monument = memo(function Monument() {
  const { uRuin } = useWorld()
  const geo = useMemo(() => {
    const hull = crescentHull(9.5, 3.4, 1.6)
    hull.translate(0, 0.6, 0)
    const hull2 = crescentHull(7, 2.6, 1.2).rotateY(Math.PI / 2).translate(0, 0.6, 0)
    const col = new THREE.CylinderGeometry(0.55, 1.3, COLUMN_H, 7, 12)
    const pos = col.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + COLUMN_H / 2
      const a = (y / COLUMN_H) * 0.9
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + y * y * 0.002, pos.getY(i), x * Math.sin(a) + z * Math.cos(a))
    }
    col.computeVertexNormals()
    col.translate(0, COLUMN_H / 2 + 2.2, 0)
    const top = COLUMN_H + 2.2
    const F = 1.9
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x * F, top + y * F, z * F)
    const figure = [
      limb(v(0.25, 0.2, 0), v(0.3, 1.5, 0.1), 0.2 * F),
      limb(v(-0.25, 0.2, 0), v(-0.35, 1.5, -0.1), 0.2 * F),
      limb(v(0, 1.6, 0), v(0, 2.7, 0.05), 0.38 * F),
      new THREE.SphereGeometry(0.3 * F, 16, 12).translate(0, top + 3.25 * F, 0.05).toNonIndexed(),
      limb(v(0.35, 2.6, 0), v(0.75, 3.8, 0.1), 0.13 * F),
      limb(v(-0.35, 2.6, 0), v(-0.65, 3.85, -0.05), 0.13 * F),
    ]
    const rings = [0, 1, 2].map((k) =>
      new THREE.TorusGeometry((0.55 + k * 0.08) * F, 0.06 * F, 8, 32)
        .rotateX(Math.PI / 2 - 0.3 + k * 0.35)
        .rotateZ(k * 0.4)
        .translate(0.05, top + (4.3 + k * 0.18) * F, 0)
        .toNonIndexed(),
    )
    const plinth = new THREE.CylinderGeometry(4.6, 4.9, 0.6, 40).translate(0, 0.3, 0).toNonIndexed()
    return { metal: mergeGeometries([hull, hull2, col.toNonIndexed(), ...figure, ...rings]), plinth }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(() => {
    const rough = pbrMaps('concrete', [2, 4]).arm
    return {
      metal: patchRuin(new THREE.MeshPhysicalMaterial({ color: '#5a3520', metalness: 0.6, roughness: 0.62, roughnessMap: rough, clearcoat: 0.1, flatShading: true }), uRuin, {
        tint: { color: '#3a3a2a', amount: 0.3 },
      }),
      plinth: patchRuin(pbrMaterial('concrete', { color: '#bdb6aa' }), uRuin, { tint: { color: '#4b5636', amount: 0.4 } }),
    }
  }, [uRuin])

  return (
    <group position={[MONUMENT.x, 0, MONUMENT.z]} rotation-y={0.5}>
      <mesh geometry={geo.metal} material={mats.metal} castShadow receiveShadow />
      <mesh geometry={geo.plinth} material={mats.plinth} castShadow receiveShadow />
    </group>
  )
})
