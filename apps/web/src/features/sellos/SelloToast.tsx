import { useEffect } from 'react'
import { create } from 'zustand'
import { explorerTx } from '../../lib/chain/networks'

export type SelloToastState = 'minting' | 'minted' | 'demo' | 'failed'

export type SelloToastData = {
  key: string
  label: string
  state: SelloToastState
  hash?: string
  error?: string
  retry?: () => void
}

type Toast = SelloToastData & { id: number }

type ToastStore = {
  toasts: Toast[]
  // Adds a toast, or updates the existing one for the same sello key.
  pushSello: (t: SelloToastData) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useSelloToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  pushSello: (t) => {
    const existing = get().toasts.find((x) => x.key === t.key)
    if (existing) {
      set({ toasts: get().toasts.map((x) => (x.key === t.key ? { ...x, ...t, error: t.error, retry: t.retry } : x)) })
    } else {
      set({ toasts: [...get().toasts, { ...t, id: nextId++ }] })
    }
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}))

const short = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`
const AUTO_DISMISS_MS: Partial<Record<SelloToastState, number>> = { minted: 7000, demo: 4500 }

// Stack of stamp notifications. Top right on wide screens, top center below the HUD on phones.
export function SelloToasts() {
  const toasts = useSelloToasts((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(12px,env(safe-area-inset-top))+96px)] z-50 flex flex-col items-center gap-3 px-4 sm:inset-x-auto sm:right-4 sm:top-[max(16px,env(safe-area-inset-top))] sm:items-end">
      {toasts.map((t) => (
        <SelloCard key={t.id} toast={t} />
      ))}
    </div>
  )
}

function SelloCard({ toast }: { toast: Toast }) {
  const dismiss = useSelloToasts((s) => s.dismiss)

  useEffect(() => {
    const ms = AUTO_DISMISS_MS[toast.state]
    if (!ms) return
    const timer = setTimeout(() => dismiss(toast.id), ms)
    return () => clearTimeout(timer)
  }, [toast.state, toast.id])

  const stampText = toast.state === 'minting' ? 'REGISTRANDO' : toast.state === 'failed' ? 'PENDIENTE' : toast.state === 'demo' ? 'SELLO' : 'SELLO MINTEADO'
  const stampColor = toast.state === 'failed' ? 'border-ink/50 text-ink/60' : 'border-alert text-alert'

  return (
    <div className="pointer-events-auto w-full max-w-sm animate-[selloIn_450ms_cubic-bezier(.2,1.4,.4,1)] rounded-xl border-4 border-ink bg-paper p-3 text-ink shadow-[6px_6px_0_#14161f]">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rotate-[-8deg] rounded border-4 px-2 py-0.5 font-display text-lg leading-tight ${stampColor} ${toast.state === 'minted' ? 'animate-[stamp_400ms_ease-out]' : ''}`}>
          {stampText}
        </div>
        <button aria-label="Cerrar" onClick={() => dismiss(toast.id)} className="ml-auto cursor-pointer text-lg leading-none text-ink/50 hover:text-ink">
          ×
        </button>
      </div>
      <p className="mt-2 font-semibold leading-snug">{toast.label}</p>

      {toast.state === 'minting' && (
        <p className="mt-1 flex items-center gap-2 text-sm text-ink/70">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          Registrando sello en la blockchain…
        </p>
      )}
      {toast.state === 'minted' && toast.hash && (
        <a href={explorerTx(toast.hash)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold underline decoration-2 underline-offset-2 hover:text-fire">
          ver tx {short(toast.hash)} ↗
        </a>
      )}
      {toast.state === 'minted' && !toast.hash && <p className="mt-1 text-sm text-ink/70">Este sello ya estaba registrado onchain.</p>}
      {toast.state === 'demo' && <p className="mt-1 text-sm text-ink/70">Sello (modo demo, sin blockchain)</p>}
      {toast.state === 'failed' && (
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-alert" title={toast.error}>
            No se pudo registrar: {toast.error}
          </p>
          {toast.retry && (
            <button onClick={toast.retry} className="btn shrink-0 px-3 py-1 text-sm">
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
