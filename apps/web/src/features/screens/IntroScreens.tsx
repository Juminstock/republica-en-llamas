import { useEffect, useState } from 'react'

// Title screen over the live 3D plaza. The start button comes from the parent (it may open the login).
export function TitleOverlay({ start }: { start: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.75)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />

      {!ready && (
        <div className="absolute inset-0 z-10 flex animate-[disclaimer_2.6s_ease-in-out_forwards] items-center justify-center bg-black p-6 text-center">
          <p className="max-w-md text-lg leading-relaxed text-paper/90">
            Obra de ficción y sátira política.
            <br />
            Los hechos narrados no ocurrieron.
          </p>
        </div>
      )}

      <div className="relative mt-auto flex flex-col items-center gap-6 px-6 pb-[max(48px,env(safe-area-inset-bottom))] text-center">
        <h1 className="animate-[titleIn_1.6s_ease-out] font-display text-[18vw] leading-[0.85] text-fire drop-shadow-[0_6px_0_#000] sm:text-8xl">
          REPÚBLICA
          <br />
          <span className="text-paper">EN LLAMAS</span>
        </h1>
        <p className="max-w-md text-base text-paper/85 drop-shadow sm:text-lg">En una Colombia en guerra, graduarse es la misión más peligrosa de todas.</p>
        <div className={ready ? 'animate-[fadeUp_700ms_ease-out]' : 'opacity-0'}>{start}</div>
      </div>
    </div>
  )
}
