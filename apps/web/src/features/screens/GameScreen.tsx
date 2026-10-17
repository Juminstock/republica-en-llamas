import { useEffect } from 'react'
import { PhaserGame } from '../../game/PhaserGame'
import { EventBus } from '../../game/EventBus'
import { useGame } from '../session/gameStore'
import { dialogueFor } from '../dialogue/task1'
import { DialogueBox } from '../dialogue/DialogueBox'
import { TouchControls } from '../controls/TouchControls'
import { chainEnabled } from '../../lib/env'
import { Settlement, ColombiaChose } from './TaskSettlement'

const STAMPS = [
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'bienestar', label: 'Bienestar' },
  { id: 'tesoreria', label: 'Tesorería' },
]

export function GameScreen() {
  const { bunuelos, stamps, dialogueId, taskComplete, toast, choices, runId } = useGame()

  useEffect(
    () =>
      EventBus.onEvent('interact', ({ id }) => {
        const state = useGame.getState()
        if (state.dialogueId || state.taskComplete) return
        state.openDialogue(dialogueFor(id))
      }),
    [],
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useGame.getState().showToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const voted = choices.some((c) => c.choiceId === 'L1_PARO')

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink">
      <PhaserGame key={runId} />

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))] text-paper">
        <div className="rounded-lg border-4 border-ink bg-paper px-3 py-1 text-ink shadow-[3px_3px_0_#14161f]">
          <div className="text-[10px] font-bold uppercase tracking-wide">Nivel 1 · Las Pasantías · Tarea 1/5</div>
          <div className="font-display text-lg leading-tight">Paz y Salvo</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            {STAMPS.map((s) => (
              <span key={s.id} className={`rounded border-2 border-ink px-1 ${stamps.includes(s.id) ? 'bg-cedula' : 'bg-white opacity-60'}`}>
                {stamps.includes(s.id) ? '✔' : '○'} {s.label}
              </span>
            ))}
            <span className={`rounded border-2 border-ink px-1 ${voted ? 'bg-cedula' : 'bg-white opacity-60'}`}>{voted ? '✔' : '○'} Asamblea</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-full border-4 border-ink bg-cedula px-3 py-1 font-bold text-ink">🟡 {bunuelos}</div>
          {!chainEnabled && <div className="rounded bg-fire px-2 py-0.5 text-[10px] font-bold uppercase">Modo demo local · sin blockchain</div>}
        </div>
      </header>

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-32 z-30 -translate-x-1/2 rounded-lg bg-ink/90 px-4 py-2 text-sm italic text-paper">{toast}</div>
      )}

      <TouchControls hidden={Boolean(dialogueId) || taskComplete} />
      <DialogueBox />
      {taskComplete && <TaskComplete />}
    </div>
  )
}

function TaskComplete() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-ink/85 p-6">
      <div className="flex max-w-sm flex-col gap-4">
        <div className="rotate-[-2deg] rounded-xl border-4 border-ink bg-paper p-6 text-center text-ink shadow-[8px_8px_0_#14161f]">
          <div className="mx-auto mb-3 w-fit rotate-[-8deg] rounded border-4 border-fire px-4 py-1 font-display text-3xl text-fire animate-[stamp_400ms_ease-out]">PAZ Y SALVO</div>
          <p>Tarea 1 completa. Tarea 2, <b>Se Busca Pasante</b>, está en construcción.</p>
          <Settlement />
        </div>
        <ColombiaChose choiceId="L1_PARO" question="La asamblea del paro" options={['Votaron con el paro', 'Cruzaron la barricada']} />
        <button className="btn" onClick={() => useGame.getState().reset()}>Jugar otra vez</button>
      </div>
    </div>
  )
}
