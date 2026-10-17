import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Animator } from './animator'
import { lookFor } from './looks'
import { buildRig, type Lod } from './rig'
import type { CharacterId, HumanoidHandle } from './types'

export type HumanoidProps = {
  id: CharacterId
  // Varies colors, hair and accessories for crowd characters (students, clerks).
  variant?: number
  // Applied on mount and when the values change. Callers may move handle.root freely afterwards.
  position?: [number, number, number]
  rotationY?: number
  castShadow?: boolean
  // Detail level; crowd characters default to a lighter sculpt.
  lod?: Lod
}

const CROWD: CharacterId[] = ['student', 'soldier']
let instances = 0

export const Humanoid = forwardRef<HumanoidHandle, HumanoidProps>(function Humanoid({ id, variant = 0, position, rotationY, castShadow = true, lod }, ref) {
  const detail = lod ?? (CROWD.includes(id) ? 'crowd' : 'hero')
  const rig = useMemo(() => buildRig(lookFor(id, variant), castShadow, detail), [id, variant, castShadow, detail])
  const animator = useMemo(() => new Animator(rig, ++instances + variant * 3), [rig, variant])
  useImperativeHandle(ref, () => animator.handle, [animator])

  const [px, py, pz] = position ?? [0, 0, 0]
  useEffect(() => {
    rig.root.position.set(px, py, pz)
  }, [rig, px, py, pz])
  useEffect(() => {
    if (rotationY !== undefined) rig.root.rotation.y = rotationY
  }, [rig, rotationY])

  useFrame((_, dt) => animator.update(Math.min(dt, 0.05)))

  return <primitive object={rig.root} />
})
