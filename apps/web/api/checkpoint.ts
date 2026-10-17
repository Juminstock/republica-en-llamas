import { isAddress, parseEther, type Address } from 'viem'
import { serverConfig, json, handleError } from './_lib/config.js'
import { domain, checkpointTypes, type Checkpoint } from './_lib/typedData.js'
import { CHOICE_IDS, TASK_EARN_CAP } from '../src/features/session/rules.js'

const CHECKPOINT_TTL_SECONDS = 900

type CheckpointRequest = {
  player: Address
  level: number
  task: number
  choices: { choiceId: string; option: number }[]
  fates: [number, number, number]
  earned: number
  spent: number
}

// Signs one task's settlement. The ledger enforces order, nonce and balance onchain;
// this endpoint enforces the game rules the chain cannot see (caps, known choices).
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckpointRequest
    if (!isAddress(body.player)) return json({ error: 'invalid_player' }, 400)
    if (body.level !== 1 || !Number.isInteger(body.task) || body.task < 1 || body.task > 5) return json({ error: 'invalid_task' }, 400)

    const earned = Math.floor(Number(body.earned))
    const spent = Math.floor(Number(body.spent))
    if (!(earned >= 0 && earned <= TASK_EARN_CAP[body.task]) || !(spent >= 0 && spent <= 1000)) return json({ error: 'invalid_amounts' }, 400)

    const choiceIds: number[] = []
    const options: number[] = []
    for (const c of body.choices ?? []) {
      const id = CHOICE_IDS[c.choiceId]
      if (id === undefined || !Number.isInteger(c.option) || c.option < 0 || c.option > 7) return json({ error: 'invalid_choice', choice: c }, 400)
      choiceIds.push(id)
      options.push(c.option)
    }
    const fates = (body.fates ?? [0, 0, 0]).map((f) => Math.min(Math.max(Math.floor(f), 0), 3)) as [number, number, number]

    const { chain, contracts, signer } = serverConfig()
    const cp: Checkpoint = {
      player: body.player,
      level: body.level,
      task: body.task,
      choiceIds,
      options,
      fates,
      earned: parseEther(String(earned)),
      spent: parseEther(String(spent)),
      nonce: BigInt(`0x${crypto.randomUUID().replace(/-/g, '')}`),
      deadline: BigInt(Math.floor(Date.now() / 1000) + CHECKPOINT_TTL_SECONDS),
    }
    const signature = await signer.signTypedData({
      domain: domain(chain.id, contracts.ledger),
      types: checkpointTypes,
      primaryType: 'Checkpoint',
      message: cp,
    })
    return json({ checkpoint: cp, signature })
  } catch (err) {
    return handleError(err)
  }
}
