import { touchInput } from '../../game/systems/input'

// Keyboard and mouse state for desktop. Touch controls write into touchInput directly.
const keys = new Set<string>()
let pointerLocked = false
let interactQueued = false

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  keys.add(e.code)
  if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) interactQueued = true
  if (e.code === 'KeyC' && !e.repeat) touchInput.sneak = !touchInput.sneak
  if (e.code === 'Space') e.preventDefault()
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code)
}
function onMouseMove(e: MouseEvent) {
  if (!pointerLocked) return
  touchInput.lookX += e.movementX
  touchInput.lookY += e.movementY
}
function onLockChange() {
  pointerLocked = document.pointerLockElement !== null
}
function onBlur() {
  keys.clear()
}

export function attachDesktopControls() {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('blur', onBlur)
  document.addEventListener('pointerlockchange', onLockChange)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('pointerlockchange', onLockChange)
    keys.clear()
  }
}

export function requestMouseLook(el: HTMLElement) {
  if (matchMedia('(pointer: coarse)').matches) return
  el.requestPointerLock?.()
}

export function releaseMouseLook() {
  if (document.pointerLockElement) document.exitPointerLock()
}

export const isMouseLooking = () => pointerLocked

// Movement intent in camera space: x right, y forward, magnitude 0..1, plus sprint.
export function readMove(out: { x: number; y: number; sprint: boolean }) {
  let x = 0
  let y = 0
  for (const code of keys) {
    const v = MOVE_KEYS[code]
    if (v) {
      x += v[0]
      y += v[1]
    }
  }
  if (x !== 0 || y !== 0) {
    const len = Math.hypot(x, y)
    out.x = x / len
    out.y = y / len
    out.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight')
    return out
  }
  out.x = touchInput.x
  out.y = -touchInput.y
  const mag = Math.hypot(out.x, out.y)
  out.sprint = touchInput.sprint || mag > 0.92
  return out
}

export function consumeInteract(): boolean {
  const queued = interactQueued || touchInput.actionPressed
  interactQueued = false
  touchInput.actionPressed = false
  return queued
}
