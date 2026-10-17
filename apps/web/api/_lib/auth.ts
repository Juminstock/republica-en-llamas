import { createRemoteJWKSet, jwtVerify } from 'jose'
import { isAddressEqual, type Address } from 'viem'
import { toAccount } from 'viem/accounts'
import { entryPoint07Address } from 'viem/account-abstraction'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { AuthError, ConfigError } from './config.js'

type LinkedAccount = { type: string; address?: string; chain_type?: string; wallet_client_type?: string }

type ReaderClient = Parameters<typeof toSimpleSmartAccount>[0]['client']

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined
const smartAccountOf = new Map<string, Address>()

const unsupported = async (): Promise<never> => {
  throw new Error('address-only owner')
}

// Same derivation as the client (src/lib/chain/smartAccount.ts), from the owner address alone.
async function smartAccountFor(owner: Address, client: ReaderClient): Promise<Address> {
  const key = owner.toLowerCase()
  const cached = smartAccountOf.get(key)
  if (cached) return cached
  const account = await toSimpleSmartAccount({
    client,
    owner: toAccount({ address: owner, signMessage: unsupported, signTransaction: unsupported, signTypedData: unsupported }),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  })
  smartAccountOf.set(key, account.address)
  return account.address
}

// Proves the request comes from the Privy user who owns `player`: the identity token is signed by
// Privy and lists the user's embedded wallet, and `player` must be that wallet's smart account.
export async function requirePlayer(request: Request, player: Address, client: ReaderClient) {
  const appId = process.env.VITE_PRIVY_APP_ID
  if (!appId) throw new ConfigError('VITE_PRIVY_APP_ID is not set')
  const token = request.headers.get('privy-id-token')
  if (!token) throw new AuthError('missing identity token')

  jwks ??= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`))
  const { payload } = await jwtVerify(token, jwks, { issuer: 'privy.io', audience: appId }).catch(() => {
    throw new AuthError('invalid identity token')
  })

  const raw = payload.linked_accounts
  const accounts = (typeof raw === 'string' ? JSON.parse(raw) : (raw ?? [])) as LinkedAccount[]
  const owners = accounts
    .filter((a) => a.type === 'wallet' && a.chain_type === 'ethereum' && a.wallet_client_type === 'privy' && a.address)
    .map((a) => a.address as Address)

  for (const owner of owners) {
    if (isAddressEqual(await smartAccountFor(owner, client), player)) return
  }
  throw new AuthError('player is not this user')
}
