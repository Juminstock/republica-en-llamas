import { isAddress, type Address } from 'viem'
import { serverConfig, json, handleError } from './_lib/config.js'
import { requirePlayer } from './_lib/auth.js'
import { domain } from './_lib/typedData.js'
import { selloTypes, sellosAbi, sellosAddress } from './_lib/sellos.js'
import { selloKeyForId } from '../src/lib/chain/sellosCatalog.js'

const SELLO_TTL_SECONDS = 600

const tokenOfAbi = [
  { type: 'function', name: 'tokenOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

// Signs one stamp for the logged-in player's smart account, which then mints it on Sellos.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { player: Address; selloId: number }
    if (!isAddress(body.player)) return json({ error: 'invalid_player' }, 400)
    const selloId = Number(body.selloId)
    if (!Number.isInteger(selloId) || !selloKeyForId(selloId)) return json({ error: 'invalid_sello' }, 400)

    const { chain, contracts, signer, publicClient } = serverConfig()
    await requirePlayer(request, body.player, publicClient)
    const sellos = sellosAddress(chain.id)

    const [cedulaId, already] = await Promise.all([
      publicClient.readContract({ address: contracts.cedula, abi: tokenOfAbi, functionName: 'tokenOf', args: [body.player] }),
      publicClient.readContract({ address: sellos, abi: sellosAbi, functionName: 'minted', args: [body.player, selloId] }),
    ])
    if (cedulaId === 0n) return json({ error: 'no_cedula' }, 409)
    if (already) return json({ error: 'already_minted' }, 409)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + SELLO_TTL_SECONDS)
    const signature = await signer.signTypedData({
      domain: domain(chain.id, sellos),
      types: selloTypes,
      primaryType: 'Sello',
      message: { player: body.player, selloId, deadline },
    })
    return json({ selloId, deadline, signature })
  } catch (err) {
    return handleError(err)
  }
}
