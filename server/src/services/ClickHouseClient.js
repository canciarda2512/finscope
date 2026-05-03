import '../config/env.js';
import { createClient } from '@clickhouse/client';
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
  await client.exec({
    query: `CREATE DATABASE IF NOT EXISTS ${process.env.CLICKHOUSE_DATABASE || 'finscope'}`
  });
}

// ── Migrationları çalıştır ──
async function runMigrations() {
  const dbDir = join(__dirname, '../database');
  const files = readdirSync(dbDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(dbDir, file), 'utf8');
    try {
      await client.exec({ query: sql });
      console.log(`✅ Migration: ${file}`);
    } catch (err) {
      console.error(`❌ Migration failed: ${file}`, err.message);
    }
  }
}

export async function initClickHouse() {
  try {
    await createDatabase();
    await runMigrations();
    console.log('✅ ClickHouse ready');
  } catch (err) {
    console.error('❌ ClickHouse init failed:', err.message);
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
  await client.exec({
    query: sql,
    query_params: params,
    clickhouse_settings: {
      mutations_sync: 1,
    },
  });
}

// ── Market verisini kaydetmek için yardımcı fonksiyon ──
export async function insertMarketData(data) {
  try {
    await client.insert({
      table: 'market_data',
      values: [
        {
          symbol: data.symbol,
          timestamp: data.timestamp,
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
          volume: parseFloat(data.volume)
        }
      ],
      format: 'JSONEachRow',
    });
  } catch (err) {
    console.error('❌ ClickHouse MarketData Insert Error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// AUTH – USERS
// ─────────────────────────────────────────────────────────────

export async function getUserByEmail(email) {
  const result = await client.query({
    query: `
      SELECT *
      FROM users
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
      FROM users
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
  insertMarketData,
  getUserByEmail,
  getUserById,
  createUser,
};
