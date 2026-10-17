import { createPublicClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet, soneiumMinato } from 'viem/chains'
import deployments from '../../src/lib/chain/deployments.json' with { type: 'json' }

const CHAINS = { monadTestnet, soneiumMinato } as const

export class ConfigError extends Error {}

export function serverConfig() {
  const networkKey = (process.env.VITE_NETWORK ?? 'monadTestnet') as keyof typeof CHAINS
  const chain = CHAINS[networkKey]
  if (!chain) throw new ConfigError(`Unknown network ${networkKey}`)

  const contracts = (deployments as Record<string, { cedula: Address; ledger: Address; bunuelo: Address }>)[String(chain.id)]
  if (!contracts) throw new ConfigError(`No deployment for chain ${chain.id}. Deploy and run contracts/scripts/export-abis.sh`)

  const key = process.env.SERVER_SIGNER_PRIVATE_KEY as Hex | undefined
  if (!key) throw new ConfigError('SERVER_SIGNER_PRIVATE_KEY is not set')

  return {
    chain,
    contracts,
    signer: privateKeyToAccount(key),
    publicClient: createPublicClient({ chain, transport: http(process.env.RPC_URL) }),
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function handleError(err: unknown) {
  if (err instanceof ConfigError) return json({ error: 'not_configured', detail: err.message }, 503)
  console.error(err)
  return json({ error: 'internal' }, 500)
}
