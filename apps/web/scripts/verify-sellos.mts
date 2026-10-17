// Verifies that viem EIP712 sello signatures are accepted by Sellos, end to end on anvil.
//   anvil
//   (contracts) SERVER_SIGNER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 METADATA_BASE_URI=http://localhost/api/metadata/ \
//     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key 0>
//   (contracts) forge script script/DeploySellos.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key 0>
//   (apps/web) node scripts/verify-sellos.mts

import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { domain, claimTypes } from '../api/_lib/typedData.ts'
import { selloTypes } from '../api/_lib/selloTypes.ts'

const root = new URL('../../../', import.meta.url).pathname
const dep = JSON.parse(readFileSync(`${root}/contracts/deployments/31337.json`, 'utf8'))
const abi = (n: string) => JSON.parse(readFileSync(`${root}/contracts/out/${n}.sol/${n}.json`, 'utf8')).abi
const server = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const player = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const pub = createPublicClient({ chain: foundry, transport: http() })
const wallet = createWalletClient({ account: player, chain: foundry, transport: http() })
const deadline = BigInt(Math.floor(Date.now() / 1000)) + 600n

if (!dep.sellos) throw new Error('deployments/31337.json has no sellos address')

const metadataHash = keccak256(toHex('cedula-metadata'))
const claimSig = await server.signTypedData({ domain: domain(31337, dep.cedula), types: claimTypes, primaryType: 'Claim', message: { player: player.address, metadataHash, deadline } })
await pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: dep.cedula, abi: abi('Cedula'), functionName: 'claim', args: [metadataHash, deadline, claimSig] }) })

for (const selloId of [1101, 1105]) {
  const sig = await server.signTypedData({ domain: domain(31337, dep.sellos), types: selloTypes, primaryType: 'Sello', message: { player: player.address, selloId, deadline } })
  const r = await pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: dep.sellos, abi: abi('Sellos'), functionName: 'mint', args: [selloId, deadline, sig] }) })
  const balance = await pub.readContract({ address: dep.sellos, abi: abi('Sellos'), functionName: 'balanceOf', args: [player.address, BigInt(selloId)] })
  console.log(`sello ${selloId}: tx ${r.status}, balance ${balance}`)
}
console.log('cedula signer unchanged:', (await pub.readContract({ address: dep.cedula, abi: abi('Cedula'), functionName: 'signer' })) === server.address)
