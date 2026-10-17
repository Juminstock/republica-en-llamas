import { create } from 'zustand'
import type { Address, Hex } from 'viem'
import type { GameAccountClient } from './smartAccount'

export type TxStatus =
  | { state: 'idle' }
  | { state: 'pending'; label: string }
  | { state: 'confirmed'; label: string; hash: Hex }
  | { state: 'queued'; label: string; error: string }

type ChainState = {
  client: GameAccountClient | null
  address: Address | null
  cedulaId: bigint | null
  tx: TxStatus
  setAccount: (client: GameAccountClient | null, address: Address | null) => void
  setCedula: (id: bigint | null) => void
  setTx: (tx: TxStatus) => void
}

export const useChain = create<ChainState>((set) => ({
  client: null,
  address: null,
  cedulaId: null,
  tx: { state: 'idle' },
  setAccount: (client, address) => set({ client, address }),
  setCedula: (cedulaId) => set({ cedulaId }),
  setTx: (tx) => set({ tx }),
}))
