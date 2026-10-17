import type { Address } from 'viem'

// Must match Sellos.SELLO_TYPEHASH byte for byte. Domain is the shared one from typedData.ts.
export const selloTypes = {
  Sello: [
    { name: 'player', type: 'address' },
    { name: 'selloId', type: 'uint16' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export type SelloMessage = { player: Address; selloId: number; deadline: bigint }
