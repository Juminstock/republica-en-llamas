import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { env, chainEnabled } from '../lib/env'
import { network } from '../lib/chain/networks'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  const app = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  if (!chainEnabled) return app

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        loginMethods: ['email', 'google', 'apple'],
        appearance: { theme: 'dark', accentColor: '#f2b705' },
        defaultChain: network.chain,
        supportedChains: [network.chain],
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
          // The player never sees a wallet prompt; the game pays gas through the paymaster.
          showWalletUIs: false,
        },
      }}
    >
      {app}
    </PrivyProvider>
  )
}
