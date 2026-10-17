import { useEffect, useState } from 'react'
import { Humanoid } from '../characters'
import type { CharacterId } from '../characters/types'

// Every look the intro and the game will need. Building one takes a few hundred ms the first time,
// so we build them one by one, hidden, while the player is still on the title screen.
const LOOKS: { id: CharacterId; variant?: number }[] = [
  { id: 'president' },
  { id: 'soldier' },
  { id: 'rector' },
  ...[0, 1, 2].map((variant) => ({ id: 'clerk' as const, variant })),
  ...[0, 1, 2, 3, 4, 5].map((variant) => ({ id: 'student' as const, variant })),
]

export function Warmup() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (count >= LOOKS.length) return
    const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 2500 : 450)
    return () => clearTimeout(t)
  }, [count])

  return (
    <group position={[0, -50, 0]} visible={false}>
      {LOOKS.slice(0, count).map((l) => (
        <Humanoid key={`${l.id}-${l.variant ?? 0}`} id={l.id} variant={l.variant} />
      ))}
    </group>
  )
}
