import type { Abi, Address } from 'viem'
import deployments from './deployments.json'
import cedulaAbi from './abis/Cedula.json'
import bunueloAbi from './abis/Bunuelo.json'
import ledgerAbi from './abis/RepublicaLedger.json'
import { network } from './networks'

type Deployment = { cedula: Address; bunuelo: Address; ledger: Address }

export const deployment = (deployments as Record<string, Deployment>)[String(network.chain.id)] ?? null

export const abis = {
  cedula: cedulaAbi as Abi,
  bunuelo: bunueloAbi as Abi,
  ledger: ledgerAbi as Abi,
}
