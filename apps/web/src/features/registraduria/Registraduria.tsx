import { useMemo, useState } from 'react'
import type { Hex } from 'viem'
import { cedulaSvg } from '../../../api/_lib/cedulaSvg'
import { claimCedula } from '../../lib/chain/actions'
import { useChain } from '../../lib/chain/chainStore'
import { explorerTx } from '../../lib/chain/networks'
import { useGame } from '../session/gameStore'
import { toCedulaPhoto } from './photo'

const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Pasto', 'Cúcuta', 'Otra']
const CAREERS = ['Ingeniería de Sistemas', 'Medicina', 'Derecho', 'Economía', 'Comunicación', 'Diseño', 'Otra']
const RH = ['O+ de Paciencia', 'A− de Ánimo', 'B+ de Berraquera', 'AB+ de Aguante', 'O− de Plata']

type Step = 'form' | 'printing' | 'done' | 'error'

export function Registraduria() {
  const cedulaId = useChain((s) => s.cedulaId)
  const [form, setForm] = useState({ alias: '', city: CITIES[0], university: '', career: CAREERS[0], rh: RH[0] })
  const [photo, setPhoto] = useState<string | undefined>()
  const [consent, setConsent] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const [hash, setHash] = useState<Hex | null>(null)

  const preview = useMemo(
    () => cedulaSvg({ tokenId: Number(cedulaId ?? 0n), stamps: 0, identity: { ...form, alias: form.alias || 'Tu alias', university: form.university || 'Tu universidad', photoUrl: photo ?? null } }),
    [form, photo, cedulaId],
  )

  async function submit() {
    setStep('printing')
    try {
      setHash(await claimCedula({ ...form, photo: consent ? photo : undefined }))
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const valid = form.alias.trim().length >= 2 && form.university.trim().length >= 2 && (!photo || consent)

  return (
    <div className="min-h-dvh bg-ink p-4 text-paper">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h2 className="font-display text-3xl text-cedula">REGISTRADURÍA</h2>
        <div className="overflow-hidden rounded-xl shadow-[6px_6px_0_#000]" dangerouslySetInnerHTML={{ __html: preview.replace('<svg ', '<svg style="width:100%;height:auto" ') }} />

        {step === 'form' && (
          <div className="flex flex-col gap-3">
            <label className="btn-ghost text-center">
              {photo ? 'Cambiar foto' : '📷 Tomarte la foto de la cédula'}
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={async (e) => e.target.files?.[0] && setPhoto(await toCedulaPhoto(e.target.files[0]))} />
            </label>
            <Field label="Alias"><input className="input" maxLength={24} value={form.alias} onChange={set('alias')} placeholder="Como te dicen en la U" /></Field>
            <Field label="Universidad"><input className="input" maxLength={60} value={form.university} onChange={set('university')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Carrera"><select className="input" value={form.career} onChange={set('career')}>{CAREERS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Ciudad"><select className="input" value={form.city} onChange={set('city')}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <Field label="RH"><select className="input" value={form.rh} onChange={set('rh')}>{RH.map((c) => <option key={c}>{c}</option>)}</select></Field>
            {photo && (
              <label className="flex items-start gap-2 text-sm text-paper/80">
                <input type="checkbox" className="mt-1 size-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                Acepto que mi foto se guarde fuera de la blockchain para mostrar mi cédula. Puedo pedir que la borren cuando quiera. Nunca se publica onchain.
              </label>
            )}
            <p className="text-xs text-paper/50">Solo datos de juego. No pongas tu nombre real ni tu número de cédula.</p>
            <button className="btn text-xl" disabled={!valid} onClick={submit}>Imprimir mi cédula</button>
          </div>
        )}

        {step === 'printing' && <p className="animate-pulse text-center text-lg">🖨️ Imprimiendo cédula… (registrando en la blockchain, gratis para ti)</p>}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="font-display text-2xl text-cedula">¡YA EXISTES, CIUDADANO!</p>
            {hash && <a className="text-sm underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">Ver tu cédula en el explorador</a>}
            <button className="btn text-xl" onClick={() => useGame.getState().go('game')}>Empezar Nivel 1</button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-alert">La Registraduría se cayó: {error}</p>
            <button className="btn" onClick={() => setStep('form')}>Intentar otra vez</button>
            <button className="btn-ghost text-sm" onClick={() => useGame.getState().go('game')}>Jugar sin cédula por ahora</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-paper/70">
      {label}
      {children}
    </label>
  )
}
