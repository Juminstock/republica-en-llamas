import type { Abi, Address, Hex } from 'viem'
import { getIdentityToken } from '@privy-io/react-auth'
import deployments from './deployments.json'
import sellosAbi from './abis/Sellos.json'
import { network, explorerTx } from './networks'
import { publicClient } from './smartAccount'
import { useChain } from './chainStore'
import { chainEnabled } from '../env'
import { SELLOS, SELLO_KEYS, type SelloKey } from './sellosCatalog'
import { useSelloToasts } from '../../features/sellos/SelloToast'

export { SELLOS, SELLO_KEYS, type SelloKey }

const abi = sellosAbi as Abi

export const sellosAddress: Address | null =
  (deployments as Record<string, { sellos?: Address }>)[String(network.chain.id)]?.sellos ?? null

export const selloExplorerUrl = (hash: string) => explorerTx(hash)
export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`

async function post<T>(path: string, body: unknown): Promise<T> {
  const idToken = await getIdentityToken()
  if (!idToken) throw new Error('Sesión expirada, vuelve a iniciar sesión')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'privy-id-token': idToken },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

// Server signs the stamp for this player; the smart account mints it with gas paid by the paymaster.
export async function mintSello(key: SelloKey): Promise<Hex> {
  const { client, address } = useChain.getState()
  if (!client || !address || !sellosAddress) throw new Error('Cuenta o contrato de sellos no disponible')
  const { selloId, deadline, signature } = await post<{ selloId: number; deadline: string; signature: Hex }>('/api/sello', {
    player: address,
    selloId: SELLOS[key].id,
  })
  return client.writeContract({
    account: client.account!,
    chain: network.chain,
    address: sellosAddress,
    abi,
    functionName: 'mint',
    args: [selloId, BigInt(deadline), signature],
  })
}

export async function readSellos(address: Address): Promise<SelloKey[]> {
  if (!sellosAddress) return []
  const owned = await Promise.all(
    SELLO_KEYS.map((k) =>
      publicClient.readContract({ address: sellosAddress!, abi, functionName: 'minted', args: [address, SELLOS[k].id] }) as Promise<boolean>,
    ),
  )
  return SELLO_KEYS.filter((_, i) => owned[i])
}

const inFlight = new Set<SelloKey>()

// Awards a stamp: onchain when possible, a clearly labeled demo stamp otherwise. Never throws.
export async function awardSello(key: SelloKey): Promise<void> {
  if (inFlight.has(key)) return
  const toasts = useSelloToasts.getState()
  const label = SELLOS[key].label
  const { address, cedulaId } = useChain.getState()
  const onchain = chainEnabled && sellosAddress && address && cedulaId && cedulaId > 0n

  if (!onchain) {
    toasts.pushSello({ key, label, state: 'demo' })
    return
  }
  inFlight.add(key)
  toasts.pushSello({ key, label, state: 'minting' })
  try {
    const hash = await mintSello(key)
    toasts.pushSello({ key, label, state: 'minted', hash })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('already_minted')) toasts.pushSello({ key, label, state: 'minted' })
    else toasts.pushSello({ key, label, state: 'failed', error: message, retry: () => void awardSello(key) })
  } finally {
    inFlight.delete(key)
  }
}
