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
        // Apple needs an Apple Developer account and its own OAuth credentials; add it later.
        loginMethods: ['email', 'google'],
        appearance: { theme: 'dark', accentColor: '#f2b705' },
        defaultChain: network.chain,
        supportedChains: [network.chain],
        // We never use Coinbase's smart wallet (it doesn't support our chain); EOA mode silences its chain check.
        externalWallets: { coinbaseWallet: { config: { preference: { options: 'eoaOnly' } } } },
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
