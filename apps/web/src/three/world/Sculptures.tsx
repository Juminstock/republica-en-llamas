import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useWorld } from './context'
import { useInstances, type Inst } from './instancing'
import { PEDESTAL_SIZE, SCULPTURES } from './layout'
import { patchRuin } from './ruinShader'
import { pbrMaps, pbrMaterial } from './pbr'

type V3 = [number, number, number]
const PED_H = 1.2

function ellipsoid(c: V3, r: V3, rot: V3 = [0, 0, 0]) {
  const g = new THREE.SphereGeometry(1, 48, 32)
  g.scale(...r)
  g.rotateX(rot[0])
  g.rotateY(rot[1])
  g.rotateZ(rot[2])
  g.translate(...c)
  return g
}

// Capsule between two points; rounded limbs read as cast bronze.
function limb(a: V3, b: V3, radius: number) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const len = va.distanceTo(vb)
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.01, len), 10, 24)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
  g.applyQuaternion(q)
  const mid = va.add(vb).multiplyScalar(0.5)
  g.translate(mid.x, mid.y, mid.z)
  return g
}

function cone(c: V3, r: number, h: number, rot: V3) {
  const g = new THREE.ConeGeometry(r, h, 16)
  g.rotateX(rot[0])
  g.rotateZ(rot[2])
  g.translate(...c)
  return g
}

const y0 = PED_H

const BUILDERS: Record<(typeof SCULPTURES)[number]['kind'], () => THREE.BufferGeometry[]> = {
  horse: () => [
    ellipsoid([0, y0 + 2.15, 0], [2.0, 1.4, 1.3]),
    ellipsoid([-1.25, y0 + 2.2, 0], [1.15, 1.3, 1.3]),
    ellipsoid([1.2, y0 + 2.45, 0], [1.0, 1.2, 1.1]),
    ...[
      [1.2, 0.62],
      [1.2, -0.62],
      [-1.3, 0.62],
      [-1.3, -0.62],
    ].map(([x, z]) => limb([x, y0 + 0.3, z], [x * 0.95, y0 + 1.6, z * 0.9], 0.46)),
    limb([1.7, y0 + 2.9, 0], [2.35, y0 + 3.7, 0], 0.72),
    ellipsoid([2.15, y0 + 3.65, 0], [0.5, 0.75, 0.32], [0, 0, -0.75]),
    ellipsoid([2.85, y0 + 3.55, 0], [0.95, 0.55, 0.5], [0, 0, -0.95]),
    cone([2.55, y0 + 4.35, 0.25], 0.13, 0.45, [0, 0, 0.35]),
    cone([2.55, y0 + 4.35, -0.25], 0.13, 0.45, [0, 0, 0.35]),
    limb([-2.25, y0 + 2.6, 0], [-2.55, y0 + 1.2, 0], 0.2),
  ],
  figure: () => [
    limb([0.38, y0 + 0.25, 0], [0.4, y0 + 1.5, 0], 0.42),
    limb([-0.38, y0 + 0.25, 0], [-0.4, y0 + 1.5, 0], 0.42),
    ellipsoid([0, y0 + 2.45, 0], [1.15, 1.45, 0.95]),
    ellipsoid([0, y0 + 4.05, 0], [0.42, 0.48, 0.42]),
    limb([1.05, y0 + 3.1, 0], [1.3, y0 + 1.9, 0.2], 0.34),
    limb([-1.05, y0 + 3.1, 0], [-1.35, y0 + 2.4, 0.5], 0.34),
    ellipsoid([1.32, y0 + 1.7, 0.22], [0.26, 0.3, 0.26]),
    ellipsoid([-1.38, y0 + 2.3, 0.65], [0.26, 0.3, 0.26]),
    ellipsoid([0, y0 + 4.48, 0], [0.5, 0.12, 0.5]),
  ],
  reclining: () => [
    ellipsoid([0, y0 + 1.0, 0], [2.0, 0.85, 1.05]),
    ellipsoid([-1.3, y0 + 1.05, 0], [1.2, 1.0, 1.15]),
    ellipsoid([1.7, y0 + 1.6, 0], [0.75, 0.9, 0.85]),
    ellipsoid([2.15, y0 + 2.6, 0], [0.45, 0.5, 0.45]),
    limb([1.6, y0 + 1.2, 0.8], [2.2, y0 + 2.4, 0.4], 0.3),
    limb([-1.8, y0 + 0.8, 0.35], [-3.4, y0 + 0.7, 0.45], 0.42),
    limb([-1.8, y0 + 0.9, -0.35], [-3.2, y0 + 1.3, -0.5], 0.42),
  ],
  bird: () => [
    ellipsoid([0, y0 + 2.0, 0], [1.45, 1.25, 1.05]),
    ellipsoid([1.15, y0 + 3.15, 0], [0.62, 0.6, 0.56]),
    cone([1.85, y0 + 3.1, 0], 0.18, 0.7, [0, 0, -Math.PI / 2]),
    cone([-1.6, y0 + 2.35, 0], 0.5, 1.3, [0, 0, Math.PI / 2.4]),
    ellipsoid([0, y0 + 2.1, 0.95], [1.0, 0.55, 0.22], [0, 0, 0.2]),
    ellipsoid([0, y0 + 2.1, -0.95], [1.0, 0.55, 0.22], [0, 0, 0.2]),
    limb([0.3, y0 + 0.05, 0.35], [0.25, y0 + 0.95, 0.3], 0.13),
    limb([0.3, y0 + 0.05, -0.35], [0.25, y0 + 0.95, -0.3], 0.13),
  ],
  head: () => [
    ellipsoid([0, y0 + 1.95, 0], [1.45, 1.75, 1.4]),
    ellipsoid([1.32, y0 + 2.0, 0], [0.35, 0.42, 0.26]),
    ellipsoid([1.3, y0 + 1.3, 0], [0.2, 0.12, 0.38]),
    ellipsoid([-0.6, y0 + 3.4, 0], [0.75, 0.55, 0.75]),
    ellipsoid([0, y0 + 0.3, 0], [0.75, 0.4, 0.75]),
  ],
}

export const Sculptures = memo(function Sculptures() {
  const { uRuin } = useWorld()

  const geos = useMemo(() => {
    const cache = new Map<string, THREE.BufferGeometry>()
    for (const s of SCULPTURES) if (!cache.has(s.kind)) cache.set(s.kind, mergeGeometries(BUILDERS[s.kind]().map((g) => g.toNonIndexed())))
    return cache
  }, [])
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])

  const mats = useMemo(
    () => ({
      bronze: (() => {
        // Polished highlights where hands touch, darker patina in the hollows (roughness from a concrete ARM map).
        const rough = pbrMaps('concrete', [3, 3]).arm
        const m = new THREE.MeshPhysicalMaterial({ color: '#5b3a24', metalness: 0.92, roughness: 0.42, roughnessMap: rough, clearcoat: 0.35, clearcoatRoughness: 0.35 })
        return patchRuin(m, uRuin, { tint: { color: '#3c4a36', amount: 0.4 } })
      })(),
      granite: patchRuin(pbrMaterial('concrete', { color: '#8f8a84', repeat: [1, 1] }), uRuin, { tint: { color: '#4b5636', amount: 0.45 } }),
    }),
    [uRuin],
  )

  const pedestals: Inst[] = useMemo(
    () => SCULPTURES.map((s) => ({ p: [s.at[0], PED_H / 2 * s.scale, s.at[2]], r: [0, s.rotY, 0], s: [PEDESTAL_SIZE * s.scale, PED_H * s.scale, PEDESTAL_SIZE * s.scale] })),
    [],
  )
  const ped = useRef<THREE.InstancedMesh>(null)
  useInstances(ped, pedestals)

  return (
    <group>
      <instancedMesh ref={ped} args={[undefined, mats.granite, pedestals.length]} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      {SCULPTURES.map((s, i) => (
        <mesh
          key={i}
          geometry={geos.get(s.kind)}
          material={mats.bronze}
          position={[s.at[0], 0, s.at[2]]}
          rotation-y={s.rotY}
          scale={s.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
})
