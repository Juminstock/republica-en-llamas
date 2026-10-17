import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Humanoid } from '../characters'
import type { HumanoidHandle } from '../characters/types'
import { SEATS } from './script'

const FIRE = new THREE.Vector3(8, 0, 12)
const look = new THREE.Vector3()

// Background of the title screen: a slow crane around the ruined plaza with the students at the fire.
export function TitleScene() {
  const { camera } = useThree()
  const t = useRef(0)

  useFrame((_, dt) => {
    t.current += Math.min(dt, 1 / 20)
    const a = 0.9 + t.current * 0.045
    const r = 30 + Math.sin(t.current * 0.07) * 6
    camera.position.set(FIRE.x + Math.sin(a) * r, 7 + Math.sin(t.current * 0.11) * 2.5, FIRE.z + Math.cos(a) * r)
    look.set(FIRE.x * 0.4, 4.5, FIRE.z * 0.2 - 8)
    camera.lookAt(look)
  })

  return (
    <>
      {(['camila', 'vale', 'andres'] as const).map((id) => (
        <Seated key={id} id={id} at={SEATS[id]} />
      ))}
    </>
  )
}

function Seated({ id, at }: { id: 'camila' | 'vale' | 'andres'; at: [number, number, number] }) {
  const ref = useRef<HumanoidHandle>(null)
  return (
    <Humanoid
      ref={(h) => {
        ref.current = h
        if (!h) return
        h.root.position.set(at[0], 0, at[2])
        h.root.rotation.y = Math.atan2(FIRE.x - at[0], FIRE.z - at[2])
        h.setGesture('sit')
      }}
      id={id}
      castShadow
    />
  )
}
