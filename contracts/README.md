# Contracts

Three contracts. A game server signs each step with EIP712, and the player's Smart Account submits it.

| Contract | What it does |
| --- | --- |
| `Cedula` | Soulbound ERC721 + ERC5192 citizen ID. Each address gets one, through `claim` with a server signature. It holds a 10-bit bitmap of level stamps. |
| `Bunuelo` | ERC20 testnet game currency. Only the ledger can mint and burn. |
| `RepublicaLedger` | Server-signed task checkpoints. Mints and burns Buñuelo, tallies choices, stores fates, and stamps the Cédula when a level is completed. |

The ledger address is set once in `Cedula` and `Bunuelo`, then frozen. The deployer stays owner of `Cedula` only so it can update the metadata base URI.

## Build and test

```bash
forge build
forge test -vv
./scripts/export-abis.sh   # copies ABIs to apps/web/src/lib/chain/abis
```

## Deploy

Import the deployer key into an encrypted keystore once. Never put it in `.env`.

```bash
cast wallet import deployer --interactive
```

Monad Testnet (10143), verified on Sourcify:

```bash
SERVER_SIGNER=0x... METADATA_BASE_URI=https://<app>/api/metadata/ \
forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast \
  --verify --verifier sourcify
```

Soneium Minato (1946), verified on Blockscout:

```bash
SERVER_SIGNER=0x... METADATA_BASE_URI=https://<app>/api/metadata/ \
forge script script/Deploy.s.sol --rpc-url soneium_minato --account deployer --broadcast \
  --verify --verifier blockscout --verifier-url https://soneium-minato.blockscout.com/api/
```

The script writes the addresses to `deployments/<chainId>.json`. `SERVER_SIGNER` is the address of the game server's signing key. It is fixed in both `Cedula` and `RepublicaLedger`, so rotating it means redeploying.

## Signatures (EIP712)

The domain is `{ name: "RepublicaEnLlamas", version: "1", chainId, verifyingContract }`. The `verifyingContract` is the contract that verifies the signature: `Cedula` for claims, `RepublicaLedger` for checkpoints.

```
Claim(address player,bytes32 metadataHash,uint256 deadline)
Checkpoint(address player,uint16 level,uint8 task,uint16[] choiceIds,uint8[] options,uint8[3] fates,uint256 earned,uint256 spent,uint256 nonce,uint256 deadline)
```
