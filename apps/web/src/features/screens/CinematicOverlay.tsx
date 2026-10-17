import { useStage } from '../../three/stage'

// Letterbox, subtitles, fades and the skip button over the 3D cinematics.
export function CinematicOverlay({ onSkip }: { onSkip?: () => void }) {
  const { subtitle, letterbox, fade } = useStage()

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className={`absolute inset-x-0 top-0 bg-black transition-[height] duration-700 ease-out ${letterbox ? 'h-[11vh]' : 'h-0'}`} />
      <div className={`absolute inset-x-0 bottom-0 bg-black transition-[height] duration-700 ease-out ${letterbox ? 'h-[11vh]' : 'h-0'}`} />
      <div className="absolute inset-0 bg-black" style={{ opacity: fade }} />

      {subtitle?.style === 'title' && (
        <div key={subtitle.text} className="absolute inset-0 flex items-center justify-center px-6">
          <h2 className="animate-[titleIn_1.2s_ease-out] text-center font-display text-4xl tracking-[0.18em] text-paper drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] sm:text-6xl">
            {subtitle.text}
          </h2>
        </div>
      )}

      {subtitle?.style === 'caption' && (
        <div key={subtitle.text} className="absolute inset-x-0 bottom-[13vh] flex justify-center px-4">
          <p className="animate-[fadeUp_600ms_ease-out] max-w-3xl rounded bg-alert/90 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-paper shadow-[4px_4px_0_#000] sm:text-base">
            {subtitle.text}
          </p>
        </div>
      )}

      {subtitle && (subtitle.style === 'dialogue' || subtitle.style === 'decree' || !subtitle.style) && (
        <div key={subtitle.text} className="absolute inset-x-0 bottom-[13vh] flex justify-center px-4">
          <p className="animate-[fadeUp_400ms_ease-out] max-w-3xl text-center text-lg leading-snug text-paper drop-shadow-[0_2px_6px_rgba(0,0,0,1)] sm:text-2xl">
            {subtitle.speaker && <span className={`mr-2 font-display uppercase tracking-wide ${subtitle.style === 'decree' ? 'text-alert' : 'text-cedula'}`}>{subtitle.speaker}:</span>}
            {subtitle.text}
          </p>
        </div>
      )}

      {onSkip && (
        <button onClick={onSkip} className="btn-ghost pointer-events-auto absolute right-4 top-[calc(11vh+12px)] bg-black/40 text-sm backdrop-blur transition-transform hover:scale-[1.06]">
          Saltar ⏭
        </button>
      )}
    </div>
  )
}
