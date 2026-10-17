import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartAccount } from '../../lib/chain/smartAccount'
import { useChain } from '../../lib/chain/chainStore'
import { readCedulaId } from '../../lib/chain/actions'
import { deployment } from '../../lib/chain/contracts'
import { useGame } from '../session/gameStore'

// Keeps the smart account in the chain store for the whole session. Only mounted when Privy is configured.
export function AccountBridge() {
  const { authenticated } = usePrivy()
  const account = useSmartAccount(authenticated)
  useEffect(() => {
    const { setAccount, setCedula } = useChain.getState()
    if (account.status !== 'ready') {
      setAccount(null, null)
      return
    }
    setAccount(account.client, account.address)
    if (deployment) readCedulaId().then(setCedula).catch(() => setCedula(null))
  }, [account.status === 'ready' ? account.address : account.status])
  return null
}

export function Login() {
  const { ready, authenticated, login } = usePrivy()
  const address = useChain((s) => s.address)
  const cedulaId = useChain((s) => s.cedulaId)

  useEffect(() => {
    if (!authenticated || !address) return
    if (!deployment) {
      useGame.getState().go('game')
      return
    }
    if (cedulaId === null) return
    useGame.getState().go(cedulaId > 0n ? 'game' : 'registraduria')
  }, [authenticated, address, cedulaId])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink p-6 text-center text-paper">
      <h2 className="font-display text-4xl text-cedula">REGISTRADURÍA NACIONAL</h2>
      <p className="max-w-sm text-paper/80">
        Para graduarte primero tienes que existir. Entra con tu correo: te creamos una cuenta y tu cédula de superviviente. Sin contraseñas raras, sin pagar nada.
      </p>
      {authenticated ? (
        <p className="animate-pulse text-paper/70">Buscando tu expediente…</p>
      ) : (
        <button className="btn text-xl" disabled={!ready} onClick={login}>
          Entrar con correo o Google
        </button>
      )}
      <button className="btn-ghost text-sm" onClick={() => useGame.getState().go('game')}>
        Jugar sin cuenta (modo demo local)
      </button>
    </div>
  )
}
