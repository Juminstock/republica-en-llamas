const raw = import.meta.env

export const env = {
  network: (raw.VITE_NETWORK ?? 'monadTestnet') as string,
  privyAppId: (raw.VITE_PRIVY_APP_ID ?? '') as string,
  pimlicoApiKey: (raw.VITE_PIMLICO_API_KEY ?? '') as string,
  sponsorshipPolicyId: (raw.VITE_PIMLICO_SPONSORSHIP_POLICY_ID ?? '') as string,
}

// Without Privy or Pimlico the game still runs, in a clearly labeled local demo mode.
export const chainEnabled = Boolean(env.privyAppId && env.pimlicoApiKey)
