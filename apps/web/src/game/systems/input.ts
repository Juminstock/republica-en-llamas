// Shared mutable input written by the DOM touch controls and read by Phaser every frame.
// Deliberately outside React state: it changes at frame rate.
export const touchInput = {
  x: 0,
  y: 0,
  actionPressed: false,
  sneak: false,
}

export function consumeAction(): boolean {
  const pressed = touchInput.actionPressed
  touchInput.actionPressed = false
  return pressed
}
