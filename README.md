# República en Llamas

A satirical action adventure about three students trying to graduate in a Colombia at war. Level 1 of 10, **Las Pasantías**, is built for the hackathon. The plan is in [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md).

> Obra de ficción y sátira política. Los hechos narrados no ocurrieron.

## Layout

| Path | What lives there |
| --- | --- |
| `apps/web` | The game: React + Vite shell, Phaser 4 scenes, Privy login, smart account client |
| `apps/web/api` | Vercel Functions: `/api/cedula`, `/api/checkpoint` and `/api/metadata/:id` sign claims and checkpoints and serve cédula metadata |
| `contracts` | Foundry: `Cedula` (soulbound), `Bunuelo` (ERC20), `RepublicaLedger` (checkpoints, choices, stamps) |
| `docs` | Game plan |

## Run locally

```bash
git submodule update --init --recursive   # forge-std and OpenZeppelin
pnpm install
pnpm dev                                   # http://localhost:5173
```

Without any env vars the game runs in **local demo mode**, labeled on screen, with no blockchain.

To turn the chain on, copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

| Variable | Where it comes from |
| --- | --- |
| `VITE_PRIVY_APP_ID` | dashboard.privy.io. Enable email, Google and Apple login, and add Monad Testnet. |
| `VITE_PIMLICO_API_KEY` | dashboard.pimlico.io. Restrict the key to your domains. |
| `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` | Optional Pimlico policy, limited to our 3 contracts with a daily cap per account |
| `SERVER_SIGNER_PRIVATE_KEY` | A fresh key used only for signing. Its address is `SERVER_SIGNER` at deploy time. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store connected to the project |

Test the account stack alone at `http://localhost:5173/?spike`: email login, then the smart account, then a sponsored UserOperation.

The API routes run under `vercel dev` (from `apps/web`), not plain `vite`.

## Contracts

```bash
cd contracts
forge test                 # 41 tests
```

Deploy and verify: see [`contracts/README.md`](contracts/README.md). After deploying, run `pnpm abis` to copy the ABIs and `deployments/<chainId>.json` into the web app.

`pnpm --filter web verify:eip712` checks, on a local anvil chain, that the server's viem signatures are accepted by the contracts. Instructions are at the top of the script.

## Network

`VITE_NETWORK=monadTestnet` (default) or `soneiumMinato`. Switching networks means redeploying the contracts with the same script, running `pnpm abis` and changing the variable. Pimlico supports both networks.
