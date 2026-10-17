// Three buñuelos stacked in a little pyramid, each rolling and bouncing on its own rhythm.
export function BunueloIcon({ size = 28, still = false }: { size?: number; still?: boolean }) {
  const ball = size * 0.56
  const balls = [
    { left: 0, top: size - ball, delay: '0s' },
    { left: size - ball, top: size - ball, delay: '0.35s' },
    { left: (size - ball) / 2, top: size * 0.06, delay: '0.7s' },
  ]
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-x-[10%] bottom-[-6%] h-[18%] rounded-[50%] bg-black/35 blur-[2px]" />
      {balls.map((b, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${still ? '' : 'animate-[bunueloBounce_1.6s_ease-in-out_infinite]'}`}
          style={{ left: b.left, top: b.top, width: ball, height: ball, animationDelay: b.delay }}
        >
          <img
            src="/assets/ui/bunuelo.png"
            alt=""
            draggable={false}
            className={`size-full rounded-full ${still ? '' : 'animate-[bunueloRoll_5s_linear_infinite]'}`}
            style={{ animationDelay: b.delay }}
          />
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,240,200,0.55),transparent_42%,rgba(90,30,0,0.35)_100%)]" />
        </span>
      ))}
    </span>
  )
}
