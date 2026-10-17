import { useGame } from '../session/gameStore'
import { chainEnabled } from '../../lib/env'

export function Disclaimer() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink p-6 text-paper">
      <div className="max-w-md text-center">
        <p className="mb-6 text-lg leading-relaxed">
          Obra de ficción y sátira política.
          <br />
          Los hechos narrados no ocurrieron.
        </p>
        <button className="btn" onClick={() => useGame.getState().go('title')}>Entendido</button>
      </div>
    </div>
  )
}

export function Title() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-ink p-6 text-center text-paper">
      <div>
        <h1 className="font-display text-6xl leading-none text-fire drop-shadow-[4px_4px_0_#000] sm:text-7xl">
          REPÚBLICA
          <br />
          EN LLAMAS
        </h1>
        <p className="mt-4 text-paper/80">Nivel 1 · Las Pasantías</p>
      </div>
      <p className="max-w-sm text-paper/70">En una Colombia en guerra, graduarse es la misión más peligrosa de todas.</p>
      <button className="btn text-xl" onClick={() => useGame.getState().go(chainEnabled ? 'login' : 'game')}>JUGAR</button>
    </div>
  )
}
