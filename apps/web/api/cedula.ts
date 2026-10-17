import { put } from '@vercel/blob'
import { isAddress, keccak256, toHex, type Address } from 'viem'
import { serverConfig, json, handleError } from './_lib/config.js'
import { domain, claimTypes } from './_lib/typedData.js'

const MAX_PHOTO_BYTES = 600_000
const CLAIM_TTL_SECONDS = 600

type CedulaRequest = {
  player: Address
  alias: string
  city: string
  university: string
  career: string
  rh: string
  photo?: string // data URL, already filtered and resized on the client
}

const clean = (s: unknown, max = 40) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max)

// Registraduría: stores the game identity offchain and returns a signed claim
// the player's smart account submits to Cedula.claim().
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CedulaRequest
    if (!isAddress(body.player)) return json({ error: 'invalid_player' }, 400)
    const alias = clean(body.alias, 24)
    if (!alias) return json({ error: 'alias_required' }, 400)

    const { chain, contracts, signer, publicClient } = serverConfig()

    const existing = await publicClient.readContract({
      address: contracts.cedula,
      abi: [{ type: 'function', name: 'tokenOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'tokenOf',
      args: [body.player],
    })
    if (existing !== 0n) return json({ error: 'already_claimed', tokenId: existing }, 409)

    const player = body.player.toLowerCase()
    let photoUrl: string | null = null
    if (body.photo?.startsWith('data:image/')) {
      const bytes = Buffer.from(body.photo.split(',')[1] ?? '', 'base64')
      if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'photo_too_large' }, 413)
      const blob = await put(`cedulas/${player}/photo.jpg`, bytes, { access: 'public', contentType: 'image/jpeg', allowOverwrite: true })
      photoUrl = blob.url
    }

    // Game identity only. Never real names, ID numbers, birth dates or emails.
    const identity = {
      alias,
      city: clean(body.city),
      university: clean(body.university, 60),
      career: clean(body.career),
      rh: clean(body.rh, 24),
      photoUrl,
      issuedAt: new Date().toISOString(),
    }
    const metadataHash = keccak256(toHex(JSON.stringify(identity)))
    await put(`cedulas/${player}/identity.json`, JSON.stringify(identity), { access: 'public', contentType: 'application/json', allowOverwrite: true })

    const deadline = BigInt(Math.floor(Date.now() / 1000) + CLAIM_TTL_SECONDS)
    const signature = await signer.signTypedData({
      domain: domain(chain.id, contracts.cedula),
      types: claimTypes,
      primaryType: 'Claim',
      message: { player: body.player, metadataHash, deadline },
    })

    return json({ metadataHash, deadline, signature, identity })
  } catch (err) {
    return handleError(err)
  }
}
