import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Humanoid } from '../characters'
import type { HumanoidHandle } from '../characters/types'
import type { LocationLayout } from '../world/locations'
import { resolveCollisions, segmentHitsBox } from '../physics/collide'
import { consumeLook, touchInput } from '../../game/systems/input'
import { EventBus } from '../../game/EventBus'
import { useGame } from '../../features/session/gameStore'
import { TASK1, type DialogueNode, type Who } from '../../features/dialogue/task1'
import { attachDesktopControls, consumeInteract, readMove } from './controls'
import { npcCollidersFor, type NpcSpec } from './npcs'

const WALK = 1.7
const RUN = 4.6
const SNEAK = 0.9
const RADIUS = 0.36
const EYE = 1.55
const LOOK_SENSITIVITY = 0.0032

type Companion = { id: 'vale' | 'andres'; ref: React.RefObject<HumanoidHandle | null>; pos: THREE.Vector3; heading: number; speed: number; gap: number; side: number }

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const side = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const camDesired = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const speakerHead = new THREE.Vector3()
const npcHead = new THREE.Vector3()
const playerHead = new THREE.Vector3()

const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)

// Dialogue ids are "<interaction>" or "<interaction>_<step>".
export const interactionOf = (dialogueId: string) => dialogueId.split('_')[0]

export function PlayerRig({ layout, npcs }: { layout: LocationLayout; npcs: NpcSpec[] }) {
  const { camera } = useThree()
  const player = useRef<HumanoidHandle>(null)
  const vale = useRef<HumanoidHandle>(null)
  const andres = useRef<HumanoidHandle>(null)
  const npcRefs = useRef(new Map<string, HumanoidHandle>())
  const colliders = useMemo(() => [...layout.colliders, ...npcCollidersFor(npcs)], [layout, npcs])

  const state = useMemo(() => {
    const [sx, , sz] = layout.spawn
    return {
      pos: new THREE.Vector3(sx, 0, sz),
      vel: new THREE.Vector3(),
      heading: layout.spawnHeading,
      camYaw: layout.spawnHeading,
      camPitch: 0.2,
      camDist: 3.4,
      trail: [] as THREE.Vector3[],
      nearest: null as string | null,
      bob: 0,
    }
  }, [layout])
  const companions = useMemo<Companion[]>(() => {
    const h = layout.spawnHeading
    const back = (d: number, s: number) => new THREE.Vector3(state.pos.x - Math.sin(h) * d - Math.cos(h) * s, 0, state.pos.z - Math.cos(h) * d + Math.sin(h) * s)
    return [
      { id: 'vale', ref: vale, pos: back(1.2, 1.3), heading: h, speed: 0, gap: 2.2, side: 1 },
      { id: 'andres', ref: andres, pos: back(1.6, -1.4), heading: h, speed: 0, gap: 3.4, side: -1 },
    ]
  }, [layout, state])

  useEffect(() => attachDesktopControls(), [])
  useEffect(() => () => EventBus.emitEvent('interact:available', null), [])
  // Dev only: automated playtests jump next to an interaction point.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    Object.assign(window, {
      __teleport: (id: string) => {
        const it = layout.interactions.find((p) => p.id === id)
        if (it) state.pos.set(it.at[0] + 1.2, 0, it.at[2] + 1.6)
      },
    })
  }, [layout, state])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const p = player.current
    if (!p) return
    const game = useGame.getState()
    const node: DialogueNode | null = game.dialogueId ? (TASK1[game.dialogueId] ?? null) : null
    const talkingTo = game.dialogueId ? (npcs.find((n) => n.interaction === interactionOf(game.dialogueId!)) ?? null) : null
    const frozen = Boolean(game.dialogueId) || game.taskComplete

    // Look
    const [lx, ly] = consumeLook()
    if (!frozen) {
      state.camYaw -= lx * LOOK_SENSITIVITY
      state.camPitch = THREE.MathUtils.clamp(state.camPitch + ly * LOOK_SENSITIVITY, -0.3, 0.95)
    }

    // Move relative to the camera
    const move = readMove({ x: 0, y: 0, sprint: false })
    const sneaking = touchInput.sneak
    const intent = frozen ? 0 : Math.min(1, Math.hypot(move.x, move.y))
    const maxSpeed = sneaking ? SNEAK : move.sprint ? RUN : WALK
    const fx = Math.sin(state.camYaw)
    const fz = Math.cos(state.camYaw)
    const dirX = frozen ? 0 : fx * move.y - fz * move.x
    const dirZ = frozen ? 0 : fz * move.y + fx * move.x
    const len = Math.hypot(dirX, dirZ) || 1
    tmp.set((dirX / len) * maxSpeed * intent, 0, (dirZ / len) * maxSpeed * intent)
    state.vel.lerp(tmp, damp(intent > 0 ? 9 : 12, dt))
    state.pos.addScaledVector(state.vel, dt)
    resolveCollisions(state.pos, RADIUS, colliders)

    const speed = Math.hypot(state.vel.x, state.vel.z)
    if (speed > 0.15) state.heading = angleLerp(state.heading, Math.atan2(state.vel.x, state.vel.z), damp(10, dt))
    if (talkingTo) state.heading = angleLerp(state.heading, Math.atan2(talkingTo.at[0] - state.pos.x, talkingTo.at[2] - state.pos.z), damp(6, dt))

    p.root.position.copy(state.pos)
    p.root.rotation.y = state.heading
    p.setSpeed(speed)
    p.setCrouch(sneaking)
    applyStaging(p, node, 'camila')
    p.lookAt(talkingTo ? npcHead.set(talkingTo.at[0], 1.6, talkingTo.at[2]) : null)

    // Breadcrumbs for the companions
    const last = state.trail[state.trail.length - 1]
    if (!last || last.distanceToSquared(state.pos) > 0.09) {
      state.trail.push(state.pos.clone())
      if (state.trail.length > 80) state.trail.shift()
    }
    updateCompanions(companions, state, dt, frozen, talkingTo, node, colliders)

    // NPCs: react when spoken to, glance at the player when close.
    playerHead.set(state.pos.x, 1.55, state.pos.z)
    npcRefs.current.forEach((h, key) => {
      const spec = npcs.find((n) => n.key === key)
      if (!spec) return
      const speaking = Boolean(talkingTo && spec.key === talkingTo.key)
      h.setTalking(speaking && node?.who === 'npc')
      const near = Math.hypot(state.pos.x - spec.at[0], state.pos.z - spec.at[2]) < 7
      h.lookAt(near || speaking ? playerHead : null)
      if (speaking) {
        const s = node?.stage?.npc
        h.setGesture(s?.gesture ?? (node?.who === 'npc' ? 'talk' : 'none'))
        h.setExpression(s?.expression ?? 'neutral')
      } else {
        h.setGesture(spec.gesture ?? 'none')
        h.setExpression(spec.expression ?? 'neutral')
      }
    })

    // Interactions
    let best: LocationLayout['interactions'][number] | null = null
    let bestD = Infinity
    for (const it of layout.interactions) {
      const d = Math.hypot(state.pos.x - it.at[0], state.pos.z - it.at[2])
      if (d < it.radius && d < bestD) {
        best = it
        bestD = d
      }
    }
    const nearestId = frozen ? null : (best?.id ?? null)
    if (nearestId !== state.nearest) {
      state.nearest = nearestId
      EventBus.emitEvent('interact:available', best && nearestId ? { id: best.id, label: best.label, hand: best.hand } : null)
    }
    if (consumeInteract() && nearestId) {
      p.setGesture('reach')
      EventBus.emitEvent('interact', { id: nearestId })
    }

    // Camera
    if (talkingTo && node) {
      framingFor(node.who, talkingTo, state.pos, companions, p, layout.colliders)
      camera.position.lerp(camDesired, damp(4, dt))
      camTarget.lerp(lookTarget, damp(5, dt))
    } else {
      const running = speed > 3
      const portrait = (camera as THREE.PerspectiveCamera).aspect < 1 ? 1.3 : 0
      state.camDist = THREE.MathUtils.lerp(state.camDist, (running ? 4.1 : sneaking ? 2.8 : 3.4) + portrait, damp(3, dt))
      const pitch = state.camPitch
      const rightX = -Math.cos(state.camYaw)
      const rightZ = Math.sin(state.camYaw)
      const shoulder = 0.62
      const pivotY = sneaking ? EYE - 0.35 : EYE
      lookTarget.set(state.pos.x + rightX * shoulder * 0.55 + fx * 2.5, pivotY + 0.1 - pitch * 0.9, state.pos.z + rightZ * shoulder * 0.55 + fz * 2.5)
      const horiz = Math.cos(pitch) * state.camDist
      let cx = state.pos.x + rightX * shoulder - fx * horiz
      let cz = state.pos.z + rightZ * shoulder - fz * horiz
      const hit = segmentHitsBox(state.pos.x, state.pos.z, cx, cz, layout.colliders)
      if (hit < 1) {
        const k = Math.max(0.25, hit - 0.08)
        cx = state.pos.x + (cx - state.pos.x) * k
        cz = state.pos.z + (cz - state.pos.z) * k
      }
      state.bob += speed * dt * 1.6
      const bob = Math.sin(state.bob * 2) * Math.min(speed, RUN) * 0.012
      camDesired.set(cx, pivotY + Math.sin(pitch) * state.camDist + bob, cz)
      camera.position.lerp(camDesired, damp(14, dt))
      camTarget.lerp(lookTarget, damp(16, dt))
    }
    camera.lookAt(camTarget)
    const cam = camera as THREE.PerspectiveCamera
    const fov = (talkingTo ? 40 : speed > 3 ? 64 : 56) + (cam.aspect < 1 ? 14 : 0)
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, damp(3, dt))
      cam.updateProjectionMatrix()
    }
  })

  return (
    <>
      <Humanoid ref={player} id="camila" castShadow />
      <Humanoid ref={vale} id="vale" castShadow />
      <Humanoid ref={andres} id="andres" castShadow />
      {npcs.map((npc) => (
        <Humanoid
          key={npc.key}
          ref={(h) => {
            if (!h) {
              npcRefs.current.delete(npc.key)
              return
            }
            if (npcRefs.current.get(npc.key) === h) return
            npcRefs.current.set(npc.key, h)
            h.root.position.set(npc.at[0], npc.at[1], npc.at[2])
            h.root.rotation.y = npc.rotY
            h.setGesture(npc.gesture ?? 'none')
          }}
          id={npc.id}
          variant={npc.variant}
          castShadow
        />
      ))}
    </>
  )
}

function applyStaging(h: HumanoidHandle, node: DialogueNode | null, who: Who) {
  const speaking = node?.who === who
  const s = node?.stage?.[who]
  h.setTalking(speaking)
  h.setGesture(s?.gesture ?? (speaking ? 'talk' : 'none'))
  h.setExpression(s?.expression ?? 'neutral')
}

// Telltale style framing: over the shoulder onto the NPC, or a frontal single on whoever of the team speaks.
function framingFor(who: Who, npc: NpcSpec, playerPos: THREE.Vector3, companions: Companion[], player: HumanoidHandle, colliders: LocationLayout['colliders']) {
  tmp.set(npc.at[0] - playerPos.x, 0, npc.at[2] - playerPos.z).normalize()
  side.set(-tmp.z, 0, tmp.x)
  if (who === 'npc') {
    camDesired.copy(playerPos).addScaledVector(tmp, -1.5).addScaledVector(side, -0.75)
    camDesired.y = 1.75
    lookTarget.set(npc.at[0], 1.5, npc.at[2])
    return
  }
  const speaker = who === 'camila' ? player : (companions.find((c) => c.id === who)?.ref.current ?? player)
  speakerHead.copy(speaker.root.position)
  speakerHead.y = 1.52
  camDesired.copy(speakerHead).addScaledVector(tmp, 1.6).addScaledVector(side, who === 'vale' ? -0.45 : 0.45)
  // Never put the lens inside a wall, a counter or behind bars.
  const hit = segmentHitsBox(speakerHead.x, speakerHead.z, camDesired.x, camDesired.z, colliders)
  if (hit < 1) {
    const k = Math.max(0.35, hit - 0.12)
    camDesired.x = speakerHead.x + (camDesired.x - speakerHead.x) * k
    camDesired.z = speakerHead.z + (camDesired.z - speakerHead.z) * k
  }
  camDesired.y = 1.68
  lookTarget.copy(speakerHead)
}

function updateCompanions(
  companions: Companion[],
  state: { pos: THREE.Vector3; trail: THREE.Vector3[] },
  dt: number,
  frozen: boolean,
  talkingTo: NpcSpec | null,
  node: DialogueNode | null,
  colliders: LocationLayout['colliders'],
) {
  for (const c of companions) {
    const h = c.ref.current
    if (!h) continue
    let target: THREE.Vector3 = state.pos
    if (talkingTo) {
      // Step up beside the player, facing whoever they are dealing with.
      tmp.set(talkingTo.at[0] - state.pos.x, 0, talkingTo.at[2] - state.pos.z).normalize()
      tmp2.set(state.pos.x - tmp.z * 1.05 * c.side - tmp.x * 0.55, 0, state.pos.z + tmp.x * 1.05 * c.side - tmp.z * 0.55)
      target = tmp2
    } else {
      let walked = 0
      for (let i = state.trail.length - 1; i > 0; i--) {
        walked += state.trail[i].distanceTo(state.trail[i - 1])
        if (walked >= c.gap) {
          target = state.trail[i - 1]
          break
        }
      }
    }
    side.subVectors(target, c.pos).setY(0)
    const dist = side.length()
    const distToPlayer = c.pos.distanceTo(state.pos)
    const wanted = talkingTo ? Math.min(WALK, dist * 3) : frozen || distToPlayer < c.gap * 0.8 ? 0 : Math.min(RUN * 1.05, dist * 2.2)
    c.speed = THREE.MathUtils.lerp(c.speed, dist < 0.08 ? 0 : wanted, damp(5, dt))
    if (dist > 0.05 && c.speed > 0.05) {
      side.normalize()
      c.pos.addScaledVector(side, c.speed * dt)
      c.heading = angleLerp(c.heading, Math.atan2(side.x, side.z), damp(8, dt))
    } else {
      const fx = talkingTo ? talkingTo.at[0] : state.pos.x
      const fz = talkingTo ? talkingTo.at[2] : state.pos.z
      c.heading = angleLerp(c.heading, Math.atan2(fx - c.pos.x, fz - c.pos.z), damp(3, dt))
    }
    resolveCollisions(c.pos, RADIUS, colliders)
    h.root.position.copy(c.pos)
    h.root.rotation.y = c.heading
    h.setSpeed(c.speed)
    h.setCrouch(touchInput.sneak && !talkingTo)
    applyStaging(h, node, c.id)
    h.lookAt(c.speed < 0.3 ? (talkingTo ? npcHead : playerHead) : null)
  }
}
