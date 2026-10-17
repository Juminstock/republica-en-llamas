import { useEffect, useRef, useState } from 'react'
import { touchInput } from '../../game/systems/input'
import { EventBus, type HandIcon } from '../../game/EventBus'

const HAND_EMOJI: Record<HandIcon, string> = { open: '✋', fist: '✊', document: '📄', bunuelo: '🟡' }
const RADIUS = 56

export function TouchControls({ hidden }: { hidden: boolean }) {
  const [prompt, setPrompt] = useState<{ label: string; hand: HandIcon } | null>(null)

  useEffect(() => EventBus.onEvent('interact:available', (p) => setPrompt(p ? { label: p.label, hand: p.hand } : null)), [])

  if (hidden) return null
  return (
    <>
      {prompt && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border-4 border-ink bg-cedula px-4 py-1 font-semibold text-ink">
          {HAND_EMOJI[prompt.hand]} {prompt.label}
        </div>
      )}
      <Joystick />
      <div className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] right-6 z-20 flex items-end gap-3">
        <button
          aria-label="Sigilo"
          onPointerDown={() => (touchInput.sneak = !touchInput.sneak)}
          className="size-14 rounded-full border-4 border-ink bg-paper/80 text-2xl"
        >
          🤫
        </button>
        <button
          aria-label="Manos"
          onPointerDown={() => (touchInput.actionPressed = true)}
          className="size-24 rounded-full border-4 border-ink bg-cedula text-5xl shadow-[4px_4px_0_#14161f] active:translate-y-1"
        >
          {HAND_EMOJI[prompt?.hand ?? 'fist']}
        </button>
      </div>
    </>
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
      className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-6 z-20 size-36 touch-none rounded-full border-4 border-ink/70 bg-paper/20"
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
