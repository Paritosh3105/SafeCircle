import { randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';
try { await access('.env'); console.log('.env already exists; no secrets changed.'); }
catch { await writeFile('.env',`NODE_ENV=development\nPORT=4000\nWEB_ORIGIN=http://localhost:3000\nSTORE_MODE=memory\nDATABASE_URL=postgresql://safecircle:local-dev-only@localhost:5432/safecircle\nFIELD_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nTOKEN_HASH_KEY=${randomBytes(32).toString('hex')}\n`,{mode:0o600}); console.log('Local configuration created. Memory mode discards data on restart.'); }
