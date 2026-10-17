// Shared mutable input written by DOM controls and read by the 3D loop every frame.
// Deliberately outside React state: it changes at frame rate.
export const touchInput = {
  x: 0,
  y: 0,
  actionPressed: false,
  sneak: false,
  sprint: false,
  // Accumulated look deltas in pixels from touch drag or mouse; consumed each frame.
  lookX: 0,
  lookY: 0,
}

export function consumeAction(): boolean {
  const pressed = touchInput.actionPressed
  touchInput.actionPressed = false
  return pressed
}

export function consumeLook(): [number, number] {
  const look: [number, number] = [touchInput.lookX, touchInput.lookY]
  touchInput.lookX = 0
  touchInput.lookY = 0
  return look
}
