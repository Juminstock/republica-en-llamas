import type { Address, Hex } from 'viem'

// Must match the contracts byte for byte (Cedula.CLAIM_TYPEHASH, RepublicaLedger.CHECKPOINT_TYPEHASH).
export const DOMAIN_NAME = 'RepublicaEnLlamas'
export const DOMAIN_VERSION = '1'

export const domain = (chainId: number, verifyingContract: Address) => ({
  name: DOMAIN_NAME,
  version: DOMAIN_VERSION,
  chainId,
  verifyingContract,
})

export const claimTypes = {
  Claim: [
    { name: 'player', type: 'address' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const checkpointTypes = {
  Checkpoint: [
    { name: 'player', type: 'address' },
    { name: 'level', type: 'uint16' },
    { name: 'task', type: 'uint8' },
    { name: 'choiceIds', type: 'uint16[]' },
    { name: 'options', type: 'uint8[]' },
    { name: 'fates', type: 'uint8[3]' },
    { name: 'earned', type: 'uint256' },
    { name: 'spent', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export type Checkpoint = {
  player: Address
  level: number
  task: number
  choiceIds: number[]
  options: number[]
  fates: [number, number, number]
  earned: bigint
  spent: bigint
  nonce: bigint
  deadline: bigint
}

export type ClaimMessage = { player: Address; metadataHash: Hex; deadline: bigint }
