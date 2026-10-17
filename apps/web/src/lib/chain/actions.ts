import type { Hex } from 'viem'
import { getIdentityToken } from '@privy-io/react-auth'
import { abis, deployment } from './contracts'
import { network } from './networks'
import { publicClient } from './smartAccount'
import { useChain } from './chainStore'

export class ChainUnavailable extends Error {}

function ready() {
  const { client, address } = useChain.getState()
  if (!client || !address || !deployment) throw new ChainUnavailable('Cuenta o contratos no disponibles')
  return { client, address, deployment }
}

// The API only signs for the smart account of the Privy user named in this token.
async function post<T>(path: string, body: unknown): Promise<T> {
  const idToken = await getIdentityToken()
  if (!idToken) throw new ChainUnavailable('Sesión expirada, vuelve a iniciar sesión')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'privy-id-token': idToken },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export async function readCedulaId(): Promise<bigint> {
  const { address, deployment } = ready()
  return (await publicClient.readContract({ address: deployment.cedula, abi: abis.cedula, functionName: 'tokenOf', args: [address] })) as bigint
}

export type CedulaForm = { alias: string; city: string; university: string; career: string; rh: string; photo?: string }

// Server registers the game identity and signs; the smart account submits, gas paid by the paymaster.
export async function claimCedula(form: CedulaForm): Promise<Hex> {
  const { client, address, deployment } = ready()
  const { metadataHash, deadline, signature } = await post<{ metadataHash: Hex; deadline: string; signature: Hex }>('/api/cedula', { player: address, ...form })
  const hash = await client.writeContract({
    account: client.account!,
    chain: network.chain,
    address: deployment.cedula,
    abi: abis.cedula,
    functionName: 'claim',
    args: [metadataHash, BigInt(deadline), signature],
  })
  useChain.getState().setCedula(await readCedulaId())
  return hash
}

export type TaskSettlement = {
  level: number
  task: number
  choices: { choiceId: string; option: number }[]
  fates: [number, number, number]
  earned: number
  spent: number
}

type SignedCheckpoint = {
  checkpoint: { player: Hex; level: number; task: number; choiceIds: number[]; options: number[]; fates: number[]; earned: string; spent: string; nonce: string; deadline: string }
  signature: Hex
}

export async function settleTask(s: TaskSettlement): Promise<Hex> {
  const { client, address, deployment } = ready()
  const { checkpoint: cp, signature } = await post<SignedCheckpoint>('/api/checkpoint', { player: address, ...s })
  return client.writeContract({
    account: client.account!,
    chain: network.chain,
    address: deployment.ledger,
    abi: abis.ledger,
    functionName: 'commitCheckpoint',
    args: [
      { ...cp, earned: BigInt(cp.earned), spent: BigInt(cp.spent), nonce: BigInt(cp.nonce), deadline: BigInt(cp.deadline) },
      signature,
    ],
  })
}

export async function readChoiceStats(choiceId: number): Promise<number[]> {
  if (!deployment) throw new ChainUnavailable('Contratos no desplegados')
  const counts = (await publicClient.readContract({ address: deployment.ledger, abi: abis.ledger, functionName: 'getChoiceStats', args: [choiceId] })) as readonly bigint[]
  return counts.map(Number)
}
