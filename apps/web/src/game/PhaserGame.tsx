import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { Campus } from './scenes/Campus'

export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container.current,
      backgroundColor: '#14161f',
      pixelArt: false,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      physics: { default: 'arcade', arcade: { debug: false } },
      input: { activePointers: 3 },
      scene: [Campus],
    })
    // Dev only handle for automated playtests.
    if (import.meta.env.DEV) Object.assign(window, { __game: game })
    return () => game.destroy(true)
  }, [])

  return <div ref={container} className="absolute inset-0" />
}
