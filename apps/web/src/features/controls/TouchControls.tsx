import { useEffect, useRef, useState } from 'react'
import { touchInput } from '../../game/systems/input'
import { EventBus, type HandIcon } from '../../game/EventBus'

const HAND_EMOJI: Record<HandIcon, string> = { open: '✋', fist: '✊', document: '📄', bunuelo: '🟡' }
const RADIUS = 56
const TOUCH_LOOK_GAIN = 1.7
const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches

export function TouchControls({ hidden }: { hidden: boolean }) {
  const [prompt, setPrompt] = useState<{ label: string; hand: HandIcon } | null>(null)
  const [sneak, setSneak] = useState(touchInput.sneak)

  useEffect(() => EventBus.onEvent('interact:available', (p) => setPrompt(p ? { label: p.label, hand: p.hand } : null)), [])

  if (hidden) return null
  return (
    <>
      {prompt && (
        <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 animate-[fadeUp_250ms_ease-out]">
          <div className="flex items-center gap-2 rounded-full border-4 border-ink bg-cedula px-4 py-1.5 font-semibold text-ink shadow-[4px_4px_0_#000]">
            {!isTouch && <kbd className="rounded bg-ink px-2 font-display text-cedula">E</kbd>}
            <span>{HAND_EMOJI[prompt.hand]}</span>
            {prompt.label}
          </div>
        </div>
      )}
      {isTouch && (
        <>
          <LookZone />
          <Joystick />
          <div className="pointer-events-auto absolute bottom-[max(24px,env(safe-area-inset-bottom))] right-6 z-20 flex items-end gap-3">
            <button
              aria-label="Sigilo"
              onPointerDown={() => {
                touchInput.sneak = !touchInput.sneak
                setSneak(touchInput.sneak)
              }}
              className={`size-14 rounded-full border-4 border-ink text-2xl transition-transform active:scale-95 ${sneak ? 'bg-military' : 'bg-paper/80'}`}
            >
              🤫
            </button>
            <button
              aria-label="Manos"
              onPointerDown={() => (touchInput.actionPressed = true)}
              className={`size-24 rounded-full border-4 border-ink text-5xl shadow-[4px_4px_0_#14161f] transition-transform active:translate-y-1 ${prompt ? 'animate-pulse bg-cedula' : 'bg-cedula/70'}`}
            >
              {HAND_EMOJI[prompt?.hand ?? 'fist']}
            </button>
          </div>
        </>
      )}
    </>
  )
}

// Drag anywhere on the right side of the screen to turn the camera.
function LookZone() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null)
  return (
    <div
      className="pointer-events-auto absolute inset-y-0 right-0 z-10 w-3/5 touch-none"
      onPointerDown={(e) => {
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        touchInput.lookX += (e.clientX - l.x) * TOUCH_LOOK_GAIN
        touchInput.lookY += (e.clientY - l.y) * TOUCH_LOOK_GAIN
        l.x = e.clientX
        l.y = e.clientY
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  )
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  function update(e: React.PointerEvent) {
    const rect = base.current!.getBoundingClientRect()
    let x = e.clientX - (rect.left + rect.width / 2)
    let y = e.clientY - (rect.top + rect.height / 2)
    const len = Math.hypot(x, y)
    if (len > RADIUS) {
      x = (x / len) * RADIUS
      y = (y / len) * RADIUS
    }
    setKnob({ x, y })
    touchInput.x = x / RADIUS
    touchInput.y = y / RADIUS
  }

  function release() {
    active.current = null
    setKnob({ x: 0, y: 0 })
    touchInput.x = 0
    touchInput.y = 0
  }

  return (
    <div
      ref={base}
      className="pointer-events-auto absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-6 z-20 size-36 touch-none rounded-full border-4 border-ink/70 bg-paper/15 backdrop-blur-sm"
      onPointerDown={(e) => {
        active.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="absolute left-1/2 top-1/2 size-14 rounded-full border-4 border-ink bg-paper"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}
