import 'dotenv/config';
import { randomBytes } from 'node:crypto';

import { createApp } from './app.js';
import { MemoryStore } from './db/memory-store.js';
import { createMysqlStore } from './db/mysql-store.js';

const dbMode = (process.env.DB_MODE || 'demo').toLowerCase();
const sessionSecret = process.env.SESSION_SECRET || (dbMode === 'demo' ? randomBytes(32).toString('hex') : '');
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('Set SESSION_SECRET to a unique random value of at least 32 characters before starting in production');
}

let store;
if (dbMode === 'mysql') {
  store = await createMysqlStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'acadexa',
  });
  await store.ping();
} else if (dbMode === 'demo') {
  store = new MemoryStore();
  console.warn('Acadexa demo mode: data is held in memory and resets when the server stops.');
} else {
  throw new Error('DB_MODE must be either "demo" or "mysql"');
}

const app = createApp({
  store,
  sessionSecret,
  secureCookies: process.env.NODE_ENV === 'production',
});
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Acadexa is listening on http://localhost:${port}`));

async function shutdown() {
  server.close(async () => {
    if (typeof store.close === 'function') await store.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
