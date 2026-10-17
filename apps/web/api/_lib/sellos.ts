import type { Address } from 'viem'
import deployments from '../../src/lib/chain/deployments.json' with { type: 'json' }
import { ConfigError } from './config.js'

export { selloTypes, type SelloMessage } from './selloTypes.js'

export const sellosAbi = [
  { type: 'function', name: 'minted', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'uint16' }], outputs: [{ type: 'bool' }] },
] as const

export function sellosAddress(chainId: number): Address {
  const entry = (deployments as Record<string, { sellos?: Address }>)[String(chainId)]
  if (!entry?.sellos) throw new ConfigError(`No Sellos deployment for chain ${chainId}. Run script/DeploySellos.s.sol and contracts/scripts/export-abis.sh`)
  return entry.sellos
}
