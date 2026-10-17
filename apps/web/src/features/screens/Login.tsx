import { useEffect, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartAccount } from '../../lib/chain/smartAccount'
import { useChain } from '../../lib/chain/chainStore'
import { readCedulaId } from '../../lib/chain/actions'
import { deployment } from '../../lib/chain/contracts'

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

// "¡Empieza a jugar!": opens the Privy login first when needed, then starts the game.
export function StartWithLogin({ onStart }: { onStart: () => void }) {
  const { ready, authenticated, login } = usePrivy()
  const pending = useRef(false)

  useEffect(() => {
    if (pending.current && authenticated) {
      pending.current = false
      onStart()
    }
  }, [authenticated])

  return (
    <button
      className="btn px-10 py-3 text-2xl"
      disabled={!ready}
      onClick={() => {
        if (authenticated) return onStart()
        pending.current = true
        login()
      }}
    >
      ¡Empieza a jugar!
    </button>
  )
}
