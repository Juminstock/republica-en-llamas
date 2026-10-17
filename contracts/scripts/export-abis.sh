#!/usr/bin/env bash
# Copies contract ABIs from Foundry artifacts into the web app.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=../apps/web/src/lib/chain/abis
mkdir -p "$DEST"
for name in Cedula Bunuelo RepublicaLedger; do
  node -e "const a=require('./out/$name.sol/$name.json').abi;process.stdout.write(JSON.stringify(a,null,2)+'\n')" > "$DEST/$name.json"
  echo "exported $DEST/$name.json"
done

# Merge every deployments/<chainId>.json into one map the web app and API can import.
node -e "
const fs=require('fs');const out={};
for (const f of fs.readdirSync('deployments')) if (/^\d+\.json$/.test(f) && f!=='31337.json') out[f.replace('.json','')]=JSON.parse(fs.readFileSync('deployments/'+f,'utf8'));
fs.writeFileSync('$DEST/../deployments.json', JSON.stringify(out,null,2)+'\n');
console.log('wrote deployments.json for chains:', Object.keys(out).join(', ')||'(none yet)');
"
