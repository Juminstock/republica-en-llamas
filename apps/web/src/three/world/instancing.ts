import { useLayoutEffect, type RefObject } from 'react'
import * as THREE from 'three'

export type Inst = {
  p: [number, number, number]
  r?: [number, number, number]
  s?: number | [number, number, number]
  c?: THREE.ColorRepresentation
  // Ruin level at which this instance appears (read by patchRuin({ appear: 'instance' })).
  t?: number
}

const o = new THREE.Object3D()
const col = new THREE.Color()

export function writeInstances(mesh: THREE.InstancedMesh, items: Inst[]) {
  const thresh = new Float32Array(items.length)
  items.forEach((it, i) => {
    o.position.set(...it.p)
    o.rotation.set(...(it.r ?? [0, 0, 0]))
    if (typeof it.s === 'number' || it.s === undefined) o.scale.setScalar(it.s ?? 1)
    else o.scale.set(...it.s)
    o.updateMatrix()
    mesh.setMatrixAt(i, o.matrix)
    if (it.c !== undefined) mesh.setColorAt(i, col.set(it.c))
    thresh[i] = it.t ?? 0
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.geometry.setAttribute('aThresh', new THREE.InstancedBufferAttribute(thresh, 1))
  mesh.computeBoundingSphere()
}

export function useInstances(ref: RefObject<THREE.InstancedMesh | null>, items: Inst[]) {
  useLayoutEffect(() => {
    if (ref.current) writeInstances(ref.current, items)
  }, [ref, items])
}
