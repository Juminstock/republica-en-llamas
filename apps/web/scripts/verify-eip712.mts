// Verifies that viem EIP712 signatures are accepted by the contracts, end to end on anvil.
//   anvil
//   (contracts) SERVER_SIGNER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 METADATA_BASE_URI=http://localhost/api/metadata/ \
//     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key 0>
//   (apps/web) node scripts/verify-eip712.mts

import { createPublicClient, createWalletClient, http, keccak256, toHex, parseEther } from "viem"
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { domain, claimTypes, checkpointTypes } from '../api/_lib/typedData.ts'
import type { Checkpoint } from '../api/_lib/typedData.ts'

const root = new URL('../../../', import.meta.url).pathname
const dep = JSON.parse(readFileSync(`${root}/contracts/deployments/31337.json`, 'utf8'))
const abi = (n: string) => JSON.parse(readFileSync(`${root}/apps/web/src/lib/chain/abis/${n}.json`, 'utf8'))
const server = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const player = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const pub = createPublicClient({ chain: foundry, transport: http() })
const wallet = createWalletClient({ account: player, chain: foundry, transport: http() })
const now = BigInt(Math.floor(Date.now() / 1000)) + 600n

const metadataHash = keccak256(toHex('cedula-metadata'))
const claimSig = await server.signTypedData({ domain: domain(31337, dep.cedula), types: claimTypes, primaryType: 'Claim', message: { player: player.address, metadataHash, deadline: now } })
let h = await wallet.writeContract({ address: dep.cedula, abi: abi('Cedula'), functionName: 'claim', args: [metadataHash, now, claimSig] })
await pub.waitForTransactionReceipt({ hash: h })
console.log('cedula tokenOf:', await pub.readContract({ address: dep.cedula, abi: abi('Cedula'), functionName: 'tokenOf', args: [player.address] }))

for (let task = 1; task <= 5; task++) {
  const cp: Checkpoint = { player: player.address, level: 1, task, choiceIds: task === 1 ? [1, 2] : [3], options: task === 1 ? [1, 0] : [2], fates: [0, 1, 0], earned: parseEther('30'), spent: parseEther('5'), nonce: BigInt(task), deadline: now }
  const sig = await server.signTypedData({ domain: domain(31337, dep.ledger), types: checkpointTypes, primaryType: 'Checkpoint', message: cp })
  h = await wallet.writeContract({ address: dep.ledger, abi: abi('RepublicaLedger'), functionName: 'commitCheckpoint', args: [cp, sig] })
  const r = await pub.waitForTransactionReceipt({ hash: h })
  console.log('task', task, r.status)
}
console.log('balance:', await pub.readContract({ address: dep.bunuelo, abi: abi('Bunuelo'), functionName: 'balanceOf', args: [player.address] }))
console.log('stats choice 3:', await pub.readContract({ address: dep.ledger, abi: abi('RepublicaLedger'), functionName: 'getChoiceStats', args: [3] }))
console.log('stamps:', await pub.readContract({ address: dep.cedula, abi: abi('Cedula'), functionName: 'stampsOf', args: [1n] }))
