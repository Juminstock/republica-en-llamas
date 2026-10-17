import { head } from '@vercel/blob'
import { serverConfig, json, handleError } from '../_lib/config.js'
import { cedulaSvg, type Identity } from '../_lib/cedulaSvg.js'

const cedulaAbi = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'stampsOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint16' }] },
] as const

// ERC721 metadata for Cedula.tokenURI(id) = <base>/<id>. The image is an SVG built on request,
// so deleting a player's photo from Blob removes it from their cédula too.
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).pathname.split('/').pop() ?? ''
    if (!/^\d+$/.test(id)) return json({ error: 'invalid_id' }, 400)
    const tokenId = BigInt(id)

    const { contracts, publicClient } = serverConfig()
    const [owner, stamps] = await Promise.all([
      publicClient.readContract({ address: contracts.cedula, abi: cedulaAbi, functionName: 'ownerOf', args: [tokenId] }),
      publicClient.readContract({ address: contracts.cedula, abi: cedulaAbi, functionName: 'stampsOf', args: [tokenId] }),
    ]).catch(() => [null, 0] as const)
    if (!owner) return json({ error: 'not_found' }, 404)

    let identity: Identity = { alias: 'Ciudadano', city: '', university: '', career: '', rh: '', photoUrl: null }
    try {
      const meta = await head(`cedulas/${owner.toLowerCase()}/identity.json`)
      identity = (await (await fetch(meta.url)).json()) as Identity
    } catch {
      // Photo or identity deleted on request: render the silhouette card.
    }

    const svg = cedulaSvg({ tokenId: Number(tokenId), stamps: Number(stamps), identity })
    return json({
      name: `Cédula de Supervivencia RL-${id.padStart(6, '0')}`,
      description: 'Documento de juego de República en Llamas. Sin validez legal.',
      image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      attributes: [
        { trait_type: 'Alias', value: identity.alias },
        { trait_type: 'Carrera', value: identity.career },
        { trait_type: 'Sellos', value: Number(stamps).toString(2).split('1').length - 1 },
      ],
    })
  } catch (err) {
    return handleError(err)
  }
}
