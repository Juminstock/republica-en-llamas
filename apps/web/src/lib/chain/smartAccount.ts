import { useEffect, useState } from 'react'
import { useWallets, type ConnectedWallet } from '@privy-io/react-auth'
import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createSmartAccountClient, type SmartAccountClient } from 'permissionless'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { network, pimlicoUrl } from './networks'
import { env } from '../env'

export const publicClient = createPublicClient({
  chain: network.chain,
  transport: http(),
})

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: '0.7' },
})

export type GameAccountClient = SmartAccountClient

// Privy's embedded wallet is only the signer. The player's address is the smart account.
async function buildClient(wallet: ConnectedWallet): Promise<GameAccountClient> {
  await wallet.switchChain(network.chain.id)
  const owner = createWalletClient({
    account: wallet.address as Address,
    chain: network.chain,
    transport: custom(await wallet.getEthereumProvider()),
  })

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  })

  return createSmartAccountClient({
    account,
    chain: network.chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    paymasterContext: env.sponsorshipPolicyId
      ? { sponsorshipPolicyId: env.sponsorshipPolicyId }
      : undefined,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  }) as GameAccountClient
}

export type SmartAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; client: GameAccountClient; address: Address }
  | { status: 'error'; error: string }

export function useSmartAccount(enabled: boolean): SmartAccountState {
  const { wallets, ready } = useWallets()
  const embedded = wallets.find((w) => w.walletClientType === 'privy')
  const [state, setState] = useState<SmartAccountState>({ status: 'idle' })

  useEffect(() => {
    if (!enabled || !ready || !embedded) return
    let cancelled = false
    setState({ status: 'loading' })
    buildClient(embedded)
      .then((client) => {
        if (!cancelled) setState({ status: 'ready', client, address: client.account!.address })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, ready, embedded?.address])

  return state
}
