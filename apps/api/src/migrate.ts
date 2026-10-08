import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL required');
const pool=new pg.Pool({connectionString:url});
const client=await pool.connect();
try{
 await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(710081)");
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const directory=new URL('../../../packages/database/migrations/',import.meta.url);
 // Resolve from src/migrate.ts: apps/api/src -> repo/packages is three parent segments.
 for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort()){
  if((await client.query('SELECT name FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;
  await client.query(await readFile(new URL(name,directory),'utf8'));await client.query('INSERT INTO schema_migrations (name) VALUES ($1)',[name]);console.log(`Applied ${name}`);
 }
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
