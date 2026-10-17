import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Humanoid } from '../characters'
import type { HumanoidHandle } from '../characters/types'
import { War, type WarHandle } from '../effects/War'
import { useStage, ruinRef } from '../stage'
import { ACTORS, CUES, DURATION, LINES, SHOTS, worldAt, type Group, type Shot } from './script'

const smooth = (k: number) => k * k * (3 - 2 * k)
const v = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2])
const CAMP = ['camila', 'vale', 'andres']

// Plays the opening: the speech at the UdeA, the decree, the war, six months later, the campfire.
export function IntroDirector({ onDone }: { onDone: () => void }) {
  const { camera } = useThree()
  const war = useRef<WarHandle>(null)
  const actors = useRef(new Map<string, HumanoidHandle>())
  // Groups currently on screen; survives ref re-attachment so cues stick.
  const shown = useRef(new Set<Group>())
  // Dev only: ?t=55 starts the intro at that second.
  const t = useRef(import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('t') ?? 0) : 0)
  const fired = useRef(new Set<number>())
  const finished = useRef(false)
  const shots = useMemo(() => SHOTS.map((s) => ({ ...s, f0: v(s.from[0]), f1: v(s.from[1]), t0: v(s.to[0]), t1: v(s.to[1]) })), [])
  const scratch = useMemo(
    () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), head: new THREE.Vector3(), cam: new THREE.Vector3(), lastRuin: -1, lastMood: '', lastLine: -2, lastFade: -1, lastLocation: '' }),
    [],
  )

  useEffect(() => {
    useStage.getState().set({ letterbox: true, subtitle: null })
    return () => useStage.getState().set({ letterbox: false, subtitle: null, fade: 0 })
  }, [])

  const groupOf = (key: string) => ACTORS.find((a) => a.key === key)?.group

  useFrame((_, dt) => {
    if (finished.current) return
    t.current += Math.min(dt, 1 / 20)
    const time = t.current
    if (time >= DURATION) {
      finished.current = true
      onDone()
      return
    }

    // Camera
    const shot = shots.find((s) => time >= s.start && time < s.end) ?? shots[shots.length - 1]
    const k = smooth(THREE.MathUtils.clamp((time - shot.start) / (shot.end - shot.start), 0, 1))
    scratch.pos.lerpVectors(shot.f0, shot.t0, k)
    scratch.look.lerpVectors(shot.f1, shot.t1, k)
    applyShake(shot, time, scratch.pos)
    camera.position.copy(scratch.pos)
    camera.lookAt(scratch.look)
    const cam = camera as THREE.PerspectiveCamera
    const fov = (shot.fov ?? 50) + (cam.aspect < 1 ? 12 : 0)
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    // World state. The shader reads ruinRef every frame; React state only follows coarse steps.
    const w = worldAt(time)
    ruinRef.current = w.ruin
    const stage = useStage.getState()
    const patch: Partial<Parameters<typeof stage.set>[0]> = {}
    if (Math.abs(w.ruin - scratch.lastRuin) >= 0.1 || (w.ruin !== scratch.lastRuin && (w.ruin === 0 || w.ruin === 1))) {
      patch.ruin = w.ruin
      scratch.lastRuin = w.ruin
    }
    if (w.mood !== scratch.lastMood) {
      patch.mood = w.mood
      scratch.lastMood = w.mood
    }
    if (w.location !== scratch.lastLocation) {
      patch.location = w.location
      scratch.lastLocation = w.location
    }
    if (Math.abs(w.fade - scratch.lastFade) > 0.01) {
      patch.fade = w.fade
      scratch.lastFade = w.fade
    }

    // Subtitles, lip sync, gestures and expressions per line
    const lineIndex = LINES.findIndex((l) => time >= l.at && time < l.at + l.dur)
    if (lineIndex !== scratch.lastLine) {
      scratch.lastLine = lineIndex
      const line = LINES[lineIndex]
      patch.subtitle = line ? { speaker: line.speaker, text: line.text, style: line.style } : null
      actors.current.forEach((h, key) => h.setTalking(Boolean(line?.actor === key)))
      const speaker = line?.actor ? actors.current.get(line.actor) : null
      if (speaker && line?.gesture) speaker.setGesture(line.gesture)
      if (speaker && line?.expression) speaker.setExpression(line.expression)
      // The UdeA crowd reacts to the decrees.
      if (line?.actor === 'president') {
        const angry = /cuartel|frente|guerra/.test(line.text)
        ACTORS.filter((a) => a.group === 'udea' && a.id === 'student').forEach((a, i) => {
          const h = actors.current.get(a.key)
          if (!h) return
          h.setExpression(angry ? (i % 2 ? 'angry' : 'surprised') : (a.expression ?? 'worried'))
          h.setGesture(angry && i % 3 === 0 ? 'fistRaise' : angry && i % 3 === 1 ? 'crossArms' : 'none')
        })
      }
    }
    if (Object.keys(patch).length) stage.set(patch)

    // Cues
    CUES.forEach((cue, i) => {
      if (time < cue.at || fired.current.has(i)) return
      fired.current.add(i)
      if (cue.run === 'show') {
        shown.current = new Set(cue.groups)
        actors.current.forEach((h, key) => (h.root.visible = shown.current.has(groupOf(key)!)))
      } else if (cue.run === 'jets') {
        war.current?.flyover(new THREE.Vector3(-170, 62, -30), new THREE.Vector3(190, 70, -140), 4.2)
        war.current?.flyover(new THREE.Vector3(-180, 66, -42), new THREE.Vector3(180, 74, -152), 4.4)
      } else if (cue.run === 'blast' && cue.at3) {
        war.current?.explode(new THREE.Vector3(...cue.at3), cue.size)
      } else if (cue.run === 'standUp') {
        for (const key of CAMP) actors.current.get(key)?.setGesture('none')
      }
    })

    // Listeners look at whoever speaks; the president scans the crowd.
    const line = LINES[scratch.lastLine]
    const speaker = line?.actor ? actors.current.get(line.actor) : null
    if (speaker) scratch.head.copy(speaker.root.position).setY(speaker.root.position.y + (CAMP.includes(line!.actor!) ? 0.95 : 1.6))
    actors.current.forEach((h, key) => {
      if (!h.root.visible) return
      if (key === 'president' || key === 'president-balcony') {
        h.lookAt(scratch.cam.set(Math.sin(time * 0.6) * 6 + h.root.position.x, 1.6, h.root.position.z + 10))
        return
      }
      h.lookAt(speaker && speaker !== h ? scratch.head : null)
    })
  })

  return (
    <>
      <War ref={war} />
      {ACTORS.map((a) => (
        <Humanoid
          key={a.key}
          ref={(h) => {
            if (!h) {
              actors.current.delete(a.key)
              return
            }
            h.root.visible = shown.current.has(a.group)
            if (actors.current.get(a.key) === h) return
            actors.current.set(a.key, h)
            h.root.position.set(a.at[0], a.at[1], a.at[2])
            h.root.rotation.y = a.rotY
            h.setGesture(a.gesture)
            if (a.expression) h.setExpression(a.expression)
          }}
          id={a.id}
          variant={a.variant}
          castShadow
        />
      ))}
    </>
  )
}

function applyShake(shot: Shot, time: number, pos: THREE.Vector3) {
  if (!shot.shake) return
  const s = shot.shake
  pos.x += (Math.sin(time * 37) + Math.sin(time * 23)) * 0.05 * s
  pos.y += (Math.sin(time * 41) + Math.sin(time * 17)) * 0.05 * s
}
