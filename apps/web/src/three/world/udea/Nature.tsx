import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useWorld } from '../context'
import { useInstances, type Inst } from '../instancing'
import { pbrMaterial } from '../pbr'
import { patchRuin, ruinDepthMaterial, rng } from '../ruinShader'
import { bladeGeometry, frondGeometry, frondTexture, palmTrunk, TRUNK_LEAN } from '../Vegetation'
import { canopyClusters, clusterGeometry, foliageMaterial, leafTexture, windTime } from '../foliage'
import { UDEA_COLLIDERS, UDEA_LAWN_TREES, UDEA_PALMS, UDEA_TREES, PLAZOLETA } from './layout'

function blocked(x: number, z: number) {
  return UDEA_COLLIDERS.some((c) => (c.kind === 'box' ? x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5 && c.maxX - c.minX < 70 : false))
}

// Lush tropical campus: big canopies, palms, hedges; weeds and wild growth take over with ruin.
export const UdeANature = memo(function UdeANature() {
  const { uRuin } = useWorld()
  const geo = useMemo(
    () => ({
      trunk: palmTrunk(),
      frond: frondGeometry(),
      cluster: clusterGeometry(),
      cluster2: clusterGeometry(),
      treeTrunk: new THREE.CylinderGeometry(0.28, 0.5, 1, 8).translate(0, 0.5, 0),
      blade: bladeGeometry(),
      wildBush: clusterGeometry(),
    }),
    [],
  )
  const frondMap = useMemo(frondTexture, [])
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose())
    frondMap.dispose()
  }, [geo, frondMap])

  const mat = useMemo(
    () => ({
      trunk: pbrMaterial('bark', { repeat: [1.5, 6], color: '#b9a88e', normal: 1.2 }),
      treeTrunk: pbrMaterial('bark', { repeat: [1.2, 2], color: '#8c7a66', normal: 1.4 }),
      frond: patchRuin(
        new THREE.MeshStandardMaterial({ color: '#557f36', alphaMap: frondMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
        uRuin,
        { tint: { color: '#7a6c3a', amount: 0.3 }, grow: 0.12 },
      ),
      canopy: foliageMaterial(uRuin, 0.25),
      leafDepth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTexture(), alphaTest: 0.45 }),
      grass: patchRuin(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 }), uRuin, { appear: 'instance' }),
      hedge: foliageMaterial(uRuin, 0.35),
      wild: foliageMaterial(uRuin, 0, 'instance'),
      wildDepth: ruinDepthMaterial(uRuin, { appear: 'instance' }),
    }),
    [uRuin, frondMap],
  )

  const data = useMemo(() => {
    const r = rng(1913)
    const trunks: Inst[] = []
    const fronds: Inst[] = []
    for (const [x, z] of UDEA_PALMS) {
      const h = 10 + r() * 6
      const rot = r() * Math.PI * 2
      trunks.push({ p: [x, 0, z], r: [0, rot, 0], s: [1.1, h, 1.1] })
      const top = new THREE.Vector3(TRUNK_LEAN, h, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
      for (let i = 0; i < 15; i++) {
        const a = (i / 15) * Math.PI * 2 + r() * 0.4
        fronds.push({ p: [x + top.x, top.y - 0.1, z + top.z], r: [0, a, i % 3 === 0 ? 0.4 + r() * 0.3 : (r() - 0.4) * 0.5], s: 0.9 + r() * 0.35 })
      }
    }
    const tTrunks: Inst[] = []
    const canopy: Inst[] = []
    for (const [x, z] of [...UDEA_TREES, ...UDEA_LAWN_TREES]) {
      const h = 3.6 + r() * 3
      tTrunks.push({ p: [x, 0, z], r: [0, r() * 6, 0], s: [1.2, h, 1.2] })
      canopyClusters(x, z, h, 3.4 + r() * 2.2, r, canopy, 52)
    }
    // Distant tree mass beyond the campus edges.
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2
      const d = 95 + r() * 60
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (z > 60 && z < 110 && Math.abs(x) < 160) continue
      tTrunks.push({ p: [x, 0, z], s: [1.4, 5, 1.4] })
      canopyClusters(x, z, 5, 5 + r() * 3, r, canopy, 26)
    }
    const hedges: Inst[] = []
    const green = new THREE.Color()
    const hedge = (x: number, z: number, len: number, along: 'x' | 'z') => {
      for (let i = 0; i < len / 1.2; i++) {
        const t = i * 1.2 - len / 2
        green.setHSL(0.24 + r() * 0.06, 0.35 + r() * 0.2, 0.5 + r() * 0.15)
        hedges.push({ p: [x + (along === 'x' ? t : 0), 0.62, z + (along === 'z' ? t : 0)], r: [0, r() * 6, 0], s: [1.6, 1.1 + r() * 0.3, 1.6], c: green.clone() })
      }
    }
    hedge(-20, 36.5, 26, 'x')
    hedge(18, 35.5, 22, 'x')
    hedge(-1, 46, 6, 'z')
    hedge(-36, 20, 16, 'z')
    hedge(PLAZOLETA.minX - 1.5, 0, 30, 'z')
    hedge(23, 22, 8, 'x')

    const grass: Inst[] = []
    const wild: Inst[] = []
    const push = (x: number, z: number, bias: number) => {
      if (blocked(x, z)) return
      green.setHSL(0.16 + r() * 0.09, 0.3 + r() * 0.25, 0.16 + r() * 0.14)
      const s = 0.5 + r() * 0.9
      grass.push({ p: [x, 0, z], r: [0, r() * 6.28, 0], s: [s, s * (0.8 + r()), s], c: green.clone(), t: Math.max(0.05, r() * 0.75 - bias) })
    }
    for (let c = 0; c < 60; c++) {
      const cx = PLAZOLETA.minX + r() * (PLAZOLETA.maxX - PLAZOLETA.minX)
      const cz = PLAZOLETA.minZ + r() * (PLAZOLETA.maxZ - PLAZOLETA.minZ)
      for (let i = 0; i < 26; i++) push(cx + (r() - 0.5) * 6, cz + (r() - 0.5) * 6, 0.1)
    }
    for (let i = 0; i < 1400; i++) push(-66 + r() * 132, -66 + r() * 130, 0.25)
    for (let i = 0; i < 220; i++) {
      const x = -66 + r() * 132
      const z = -66 + r() * 130
      if (blocked(x, z)) continue
      const s = 0.5 + r() * 1.1
      green.setHSL(0.2 + r() * 0.09, 0.3 + r() * 0.2, 0.45 + r() * 0.2)
      wild.push({ p: [x, s * 0.45, z], r: [0, r() * 6, 0], s: [s * 1.5, s * 1.1, s * 1.5], c: green.clone(), t: 0.25 + r() * 0.6 })
    }
    return { trunks, fronds, tTrunks, canopy, hedges, grass, wild }
  }, [])

  useFrame(({ clock }) => {
    windTime.value = clock.elapsedTime
  })

  const refs = {
    trunks: useRef<THREE.InstancedMesh>(null),
    fronds: useRef<THREE.InstancedMesh>(null),
    tTrunks: useRef<THREE.InstancedMesh>(null),
    canopy: useRef<THREE.InstancedMesh>(null),
    hedges: useRef<THREE.InstancedMesh>(null),
    grass: useRef<THREE.InstancedMesh>(null),
    wild: useRef<THREE.InstancedMesh>(null),
  }
  ;(Object.keys(refs) as (keyof typeof refs)[]).forEach((k) => useInstances(refs[k], data[k]))

  return (
    <group>
      <instancedMesh ref={refs.trunks} args={[geo.trunk, mat.trunk, data.trunks.length]} castShadow receiveShadow />
      <instancedMesh ref={refs.fronds} args={[geo.frond, mat.frond, data.fronds.length]} castShadow />
      <instancedMesh ref={refs.tTrunks} args={[geo.treeTrunk, mat.treeTrunk, data.tTrunks.length]} castShadow />
      <instancedMesh ref={refs.canopy} args={[geo.cluster, mat.canopy, data.canopy.length]} castShadow receiveShadow customDepthMaterial={mat.leafDepth} />
      <instancedMesh ref={refs.hedges} args={[geo.cluster2, mat.hedge, data.hedges.length]} castShadow receiveShadow />
      <instancedMesh ref={refs.grass} args={[geo.blade, mat.grass, data.grass.length]} receiveShadow />
      <instancedMesh ref={refs.wild} args={[geo.wildBush, mat.wild, data.wild.length]} castShadow receiveShadow customDepthMaterial={mat.wildDepth} />
    </group>
  )
})
