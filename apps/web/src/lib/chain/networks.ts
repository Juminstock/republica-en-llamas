import { monadTestnet, soneiumMinato, type Chain } from 'viem/chains'
import { env } from '../env'

export type NetworkKey = 'monadTestnet' | 'soneiumMinato'

type Network = {
  chain: Chain
  explorer: string
}

export const NETWORKS: Record<NetworkKey, Network> = {
  monadTestnet: { chain: monadTestnet, explorer: 'https://testnet.monadvision.com' },
  soneiumMinato: { chain: soneiumMinato, explorer: 'https://soneium-minato.blockscout.com' },
}

function resolveNetwork(): NetworkKey {
  if (env.network in NETWORKS) return env.network as NetworkKey
  console.warn(`Unknown VITE_NETWORK "${env.network}", falling back to monadTestnet`)
  return 'monadTestnet'
}

export const networkKey = resolveNetwork()
export const network = NETWORKS[networkKey]

export const pimlicoUrl = `https://api.pimlico.io/v2/${network.chain.id}/rpc?apikey=${env.pimlicoApiKey}`

export const explorerTx = (hash: string) => `${network.explorer}/tx/${hash}`
export const explorerAddress = (address: string) => `${network.explorer}/address/${address}`
