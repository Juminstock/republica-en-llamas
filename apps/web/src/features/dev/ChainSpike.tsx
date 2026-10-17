import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { chainEnabled } from '../../lib/env'
import { network, explorerAddress, explorerTx } from '../../lib/chain/networks'
import { useSmartAccount } from '../../lib/chain/smartAccount'

// Day 1 proof: email login -> smart account -> sponsored UserOperation, end to end.
// Open with ?spike
export function ChainSpike() {
  if (!chainEnabled) {
    return (
      <Shell>
        <p>Falta configurar <code>VITE_PRIVY_APP_ID</code> y <code>VITE_PIMLICO_API_KEY</code> en <code>apps/web/.env.local</code>.</p>
      </Shell>
    )
  }
  return <SpikeInner />
}

function SpikeInner() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const account = useSmartAccount(authenticated)
  const [tx, setTx] = useState<{ status: string; hash?: string }>({ status: 'idle' })

  async function sendSponsored() {
    if (account.status !== 'ready') return
    setTx({ status: 'sending' })
    try {
      // A zero value call to itself: deploys the account on first use, gas paid by the paymaster.
      const hash = await account.client.sendTransaction({
        account: account.client.account!,
        chain: network.chain,
        to: account.address,
        value: 0n,
        data: '0x',
      })
      setTx({ status: 'confirmed', hash })
    } catch (err) {
      setTx({ status: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return (
    <Shell>
      <Row label="Red">{network.chain.name} ({network.chain.id})</Row>
      <Row label="Privy">{ready ? (authenticated ? `sesión: ${user?.email?.address ?? user?.id}` : 'sin sesión') : 'cargando'}</Row>
      {!authenticated ? (
        <button className="btn" onClick={login}>Entrar con correo</button>
      ) : (
        <>
          <Row label="Smart Account">
            {account.status === 'ready' ? (
              <a className="underline break-all" href={explorerAddress(account.address)} target="_blank" rel="noreferrer">{account.address}</a>
            ) : account.status === 'error' ? (
              <span className="text-red-400">{account.error}</span>
            ) : (
              account.status
            )}
          </Row>
          <button className="btn" disabled={account.status !== 'ready' || tx.status === 'sending'} onClick={sendSponsored}>
            Enviar UserOp patrocinada
          </button>
          <Row label="Tx">
            {tx.hash ? (
              <a className="underline break-all" href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">{tx.hash}</a>
            ) : (
              tx.status
            )}
          </Row>
          <button className="btn-ghost" onClick={logout}>Salir</button>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink text-paper p-6 flex flex-col gap-4 max-w-xl mx-auto">
      <h1 className="font-display text-2xl text-cedula">Prueba de cuentas (Día 1)</h1>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-paper/60">{label}: </span>
      {children}
    </div>
  )
}
