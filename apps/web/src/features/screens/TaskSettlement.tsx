import { useEffect, useState } from 'react'
import { useGame } from '../session/gameStore'
import { CHOICE_IDS } from '../session/rules'
import { useChain } from '../../lib/chain/chainStore'
import { settleTask, readChoiceStats } from '../../lib/chain/actions'
import { deployment } from '../../lib/chain/contracts'
import { explorerTx } from '../../lib/chain/networks'

// One settlement per run and task, even if React mounts the effect twice.
const started = new Set<string>()

async function settleCurrentTask(task: number) {
  const { runId, choices, taskEarned, taskSpent } = useGame.getState()
  const key = `${runId}:${task}`
  if (started.has(key)) return
  started.add(key)

  const { setTx } = useChain.getState()
  const label = `Tarea ${task}`
  setTx({ state: 'pending', label })
  try {
    const hash = await settleTask({ level: 1, task, choices, fates: [0, 0, 0], earned: taskEarned, spent: taskSpent })
    setTx({ state: 'confirmed', label, hash })
  } catch (err) {
    started.delete(key)
    setTx({ state: 'queued', label, error: err instanceof Error ? err.message : String(err) })
  }
}

export function Settlement({ task = 1 }: { task?: number }) {
  const tx = useChain((s) => s.tx)
  const canSettle = useChain((s) => Boolean(s.address && s.cedulaId && s.cedulaId > 0n)) && Boolean(deployment)

  useEffect(() => {
    if (canSettle) void settleCurrentTask(task)
  }, [canSettle, task])

  if (!canSettle) return <p className="mt-3 text-xs text-ink/60">Modo demo local: este trámite no quedó registrado en la blockchain.</p>

  return (
    <div className="mt-3 text-sm">
      {tx.state === 'pending' && <p className="animate-pulse">Registrando el trámite en la blockchain…</p>}
      {tx.state === 'confirmed' && (
        <a className="font-semibold underline" href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
          ✔ Registrado onchain · ver transacción
        </a>
      )}
      {tx.state === 'queued' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-alert">Pendiente de registrar en la blockchain ({tx.error}).</p>
          <button className="btn text-sm" onClick={() => void settleCurrentTask(task)}>Reintentar</button>
        </div>
      )}
    </div>
  )
}

export function ColombiaChose({ choiceId, question, options }: { choiceId: string; question: string; options: string[] }) {
  const mine = useGame((s) => s.choices.find((c) => c.choiceId === choiceId)?.option)
  const confirmed = useChain((s) => s.tx.state === 'confirmed')
  const [counts, setCounts] = useState<number[] | null>(null)

  useEffect(() => {
    if (!deployment) return
    readChoiceStats(CHOICE_IDS[choiceId]).then(setCounts).catch(() => setCounts(null))
  }, [choiceId, confirmed])

  const onchain = counts && counts.slice(0, options.length).some((c) => c > 0) ? counts : null
  const shown = onchain ?? options.map((_, i) => (i === mine ? 1 : 0))
  const total = shown.slice(0, options.length).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="rounded-xl border-4 border-ink bg-paper p-4 text-ink shadow-[6px_6px_0_#14161f]">
      <div className="text-xs font-bold uppercase tracking-wide text-fire">Lo que eligió Colombia</div>
      <div className="mb-3 font-display text-xl">{question}</div>
      {options.map((label, i) => {
        const pct = Math.round((shown[i] / total) * 100)
        return (
          <div key={label} className="mb-2">
            <div className="flex justify-between text-sm">
              <span className={i === mine ? 'font-bold' : ''}>{label}{i === mine ? ' · tú' : ''}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded border-2 border-ink bg-white">
              <div className={`h-full ${i === mine ? 'bg-fire' : 'bg-ink/50'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
      <p className="mt-2 text-[11px] text-ink/60">{onchain ? `${total} ciudadanos · leído de la blockchain` : 'Todavía no hay votos onchain: solo tu decisión'}</p>
    </div>
  )
}
