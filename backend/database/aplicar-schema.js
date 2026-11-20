import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const teste = process.argv.includes('--teste');
const url = teste ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL (e DATABASE_URL_TEST) no .env');
  process.exit(1);
}

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  await cliente.query(sql);
  console.log(`Schema aplicado em ${teste ? 'financas_test' : 'financas'}.`);
} finally {
  await cliente.end();
}
