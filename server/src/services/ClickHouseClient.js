import '../config/env.js';
import { createClient } from '@clickhouse/client';
import logger from '../utils/logger.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ClickHouse bağlantısı ──
export const client = createClient({
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || 8123}`,
  database: process.env.CLICKHOUSE_DATABASE || 'finscope',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  clickhouse_settings: {
    wait_end_of_query: 1,
  },
  session_settings: {
    database: process.env.CLICKHOUSE_DATABASE || 'finscope',
  },
});

// ── Veritabanını oluştur ──
async function createDatabase() {
  const initClient = createClient({
    url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || 8123}`,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });
  const { stream } = await initClient.exec({
    query: `CREATE DATABASE IF NOT EXISTS ${process.env.CLICKHOUSE_DATABASE || 'finscope'}`
  });
  // Drain the response stream to prevent ECONNRESET warnings
  stream.on('data', () => {});
  await new Promise(resolve => stream.on('end', resolve));
  await initClient.close();
}

// ── Helper: exec and drain the response stream ──
async function execAndDrain(ch, query, params = {}) {
  const { stream } = await ch.exec({ query, query_params: params });
  stream.on('data', () => {});
  await new Promise(resolve => stream.on('end', resolve));
}

// ── Migrationları çalıştır ──
async function runMigrations() {
  const dbDir = join(__dirname, '../database');
  const files = readdirSync(dbDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(dbDir, file), 'utf8');
    try {
      await execAndDrain(client, sql);
      logger.info({ file }, 'Migration applied');
    } catch (err) {
      logger.error({ err, file }, 'Migration failed');
    }
  }
}

export async function initClickHouse() {
  try {
    await createDatabase();
    await runMigrations();
    logger.info('ClickHouse ready');
  } catch (err) {
    logger.error({ err }, 'ClickHouse init failed');
  }
}

// ── SELECT sorgusu — gerçek read_rows istatistiği döndürür ──
export async function query(sql, params = {}) {
  const start = Date.now();

  const result = await client.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json();
  const queryTime = `${Date.now() - start}ms`;

  const summary = result.summary;
  const rowsRead = summary?.read_rows
    ? Number(summary.read_rows)
    : rows.length;

  return { rows, queryTime, rowsRead };
}

// ── INSERT ──
export async function insert(table, rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return;

  await client.insert({
    table,
    values: rows,
    format: 'JSONEachRow',
  });
}

// ── DDL / tek seferlik sorgu ──
export async function execute(sql, params = {}) {
  const { stream } = await client.exec({
    query: sql,
    query_params: params,
    clickhouse_settings: {
      mutations_sync: 1,
    },
  });
  stream.on('data', () => {});
  await new Promise(resolve => stream.on('end', resolve));
}

// ─────────────────────────────────────────────────────────────
// AUTH – USERS
// ─────────────────────────────────────────────────────────────

export async function getUserByEmail(email) {
  const result = await client.query({
    query: `
      SELECT *
      FROM users FINAL
      WHERE email = {email:String}
      LIMIT 1
    `,
    query_params: { email },
    format: 'JSONEachRow',
  });

  const rows = await result.json();
  return rows[0];
}

export async function getUserById(userId) {
  const result = await client.query({
    query: `
      SELECT *
      FROM users FINAL
      WHERE id = {userId:String}
      LIMIT 1
    `,
    query_params: { userId },
    format: 'JSONEachRow',
  });

  const rows = await result.json();
  return rows[0];
}

export async function createUser(user) {
  await client.insert({
    table: 'users',
    values: [
      {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        refreshToken: user.refreshToken,
        createdAt: user.createdAt,
      },
    ],
    format: 'JSONEachRow',
  });
}

export default {
  initClickHouse,
  query,
  insert,
  execute,
  client,
  getUserByEmail,
  getUserById,
  createUser,
};
