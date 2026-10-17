import { useEffect, useState } from 'react'
import { useGame } from '../session/gameStore'
import { TASK1 } from './task1'
import { BunueloIcon } from '../economy/BunueloIcon'

export function DialogueBox() {
  const dialogueId = useGame((s) => s.dialogueId)
  const node = dialogueId ? TASK1[dialogueId] : null
  if (!node || !dialogueId) return null
  return <DialogueCard key={dialogueId} id={dialogueId} />
}

function DialogueCard({ id }: { id: string }) {
  const node = TASK1[id]
  const bunuelos = useGame((s) => s.bunuelos)
  const [left, setLeft] = useState(node.timer?.seconds ?? 0)

  function pick(index: number) {
    const option = node.options[index]
    const state = useGame.getState()
    if (option.cost && !state.spend(option.cost)) {
      state.showToast('No te alcanzan los buñuelos.')
      return
    }
    state.openDialogue(option.pick())
  }

  useEffect(() => {
    if (!node.timer) return
    if (left <= 0) {
      pick(node.timer.timeoutOption)
      return
    }
    const t = setTimeout(() => setLeft((s) => s - 0.1), 100)
    return () => clearTimeout(t)
  }, [left])

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 animate-[fadeUp_300ms_ease-out] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl rounded-xl border-4 border-ink bg-paper text-ink shadow-[6px_6px_0_#14161f]">
        <div className="flex items-center justify-between border-b-4 border-ink bg-cedula px-4 py-2">
          <span className="font-display text-lg uppercase">{node.speaker}</span>{node.who !== 'npc' && <span className="ml-2 rounded bg-ink/80 px-1.5 text-[10px] font-bold uppercase text-paper">equipo</span>}
          {node.choiceId && <span className="rounded bg-ink px-2 py-0.5 text-xs text-cedula">DECISIÓN ONCHAIN</span>}
        </div>
        <p className="px-4 py-3 text-base leading-snug">{node.text}</p>
        {node.timer && (
          <div className="mx-4 mb-2 h-2 overflow-hidden rounded bg-ink/20">
            <div className="h-full bg-fire transition-[width] duration-100" style={{ width: `${(left / node.timer.seconds) * 100}%` }} />
          </div>
        )}
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {node.options.map((o, i) => (o.visible && !o.visible() ? null : (
            <button
              key={o.label}
              onClick={() => pick(i)}
              disabled={o.cost !== undefined && bunuelos < o.cost}
              className="min-h-12 cursor-pointer rounded-lg border-4 border-ink bg-white px-3 py-2 text-left font-semibold transition-transform duration-150 hover:scale-[1.03] active:translate-y-0.5 disabled:opacity-40"
            >
              {o.label}
              {o.cost !== undefined && <span className="ml-2 inline-flex items-center gap-1 align-middle text-sm text-fire">−{o.cost} <BunueloIcon size={18} still /></span>}
            </button>
          )))}
        </div>
      </div>
    </div>
  )
}
