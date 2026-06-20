// 潮线 Tideline · 轻量持久化层
// 只持久化「真实 API 同步来的数据」：本地推账户(a_*)、品牌(b_*)、投放计划(c_*)。
// 优先用 Node 内置 node:sqlite（Node ≥22.5）；不可用时自动降级到 JSON 文件。
// 二者都写到 ./data/ 目录，重启后由 loadPersisted() 注水回内存数组。

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { brands, accounts, adCampaigns } from './db';
import type { Brand, Account, AdCampaign } from '../types/index';

const require_ = createRequire(import.meta.url);

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH  = join(DATA_DIR, 'tideline.db');
const JSON_PATH = join(DATA_DIR, 'store.json');

interface Snapshot {
  brands: Brand[];
  accounts: Account[];
  adCampaigns: AdCampaign[];
}

// ─── SQLite 后端（首选）──────────────────────────────────────────────────────
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { run(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] };
};

let sqlite: SqliteDb | null = null;
let backend: 'sqlite' | 'json' = 'json';

function initSqlite(): boolean {
  try {
    // 动态 require，低版本 Node 没有 node:sqlite 时落入 catch 走 JSON 降级
    const mod = require_('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb };
    sqlite = new mod.DatabaseSync(DB_PATH);
    sqlite.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    backend = 'sqlite';
    return true;
  } catch {
    return false;
  }
}

// ─── 读写快照 ─────────────────────────────────────────────────────────────────

function writeSnapshot(snap: Snapshot) {
  if (backend === 'sqlite' && sqlite) {
    const stmt = sqlite.prepare(`INSERT INTO kv(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    stmt.run('brands',      JSON.stringify(snap.brands));
    stmt.run('accounts',    JSON.stringify(snap.accounts));
    stmt.run('adCampaigns', JSON.stringify(snap.adCampaigns));
  } else {
    writeFileSync(JSON_PATH, JSON.stringify(snap, null, 2));
  }
}

function readSnapshot(): Snapshot | null {
  try {
    if (backend === 'sqlite' && sqlite) {
      const rows = sqlite.prepare(`SELECT key, value FROM kv`).all() as Array<{ key: string; value: string }>;
      if (!rows.length) return null;
      const map = new Map(rows.map(r => [r.key, r.value]));
      return {
        brands:      JSON.parse(map.get('brands')      ?? '[]'),
        accounts:    JSON.parse(map.get('accounts')    ?? '[]'),
        adCampaigns: JSON.parse(map.get('adCampaigns') ?? '[]'),
      };
    }
    if (existsSync(JSON_PATH)) {
      return JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Snapshot;
    }
  } catch (e) {
    console.error('[Persist] 读取快照失败:', String(e));
  }
  return null;
}

// ─── 对外 API ─────────────────────────────────────────────────────────────────

let ready = false;

/** 启动时调用：初始化后端并把持久化的真实数据注水回内存数组 */
export function loadPersisted(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch { /* ignore */ }

  if (!initSqlite()) backend = 'json';

  const snap = readSnapshot();
  if (snap) {
    upsertAll(brands,      snap.brands);
    upsertAll(accounts,    snap.accounts);
    upsertAll(adCampaigns, snap.adCampaigns);
    console.log(`[Persist] ✅ 已注水 (${backend}): 账户 ${snap.accounts.length}、品牌 ${snap.brands.length}、计划 ${snap.adCampaigns.length}`);
  } else {
    console.log(`[Persist] 后端=${backend}，暂无历史快照`);
  }
  ready = true;
}

/** 同步完成后调用：把当前「真实同步数据」写盘 */
export function saveSnapshot(): void {
  if (!ready) return;
  // 只持久化 API 同步产生的实体（id/前缀区分于 mock 种子）
  const realBrands   = brands.filter(b => b.id.startsWith('b_'));
  const realAccounts = accounts.filter(a => a.id.startsWith('a_'));
  const realCamps    = adCampaigns.filter(c => !!c.externalId);
  try {
    writeSnapshot({ brands: realBrands, accounts: realAccounts, adCampaigns: realCamps });
    console.log(`[Persist] 💾 已保存 (${backend}): 账户 ${realAccounts.length}、计划 ${realCamps.length}`);
  } catch (e) {
    console.error('[Persist] 保存失败:', String(e));
  }
}

// 按 id upsert：已存在则覆盖字段，否则追加
function upsertAll<T extends { id: string }>(target: T[], incoming: T[]): void {
  for (const item of incoming) {
    const idx = target.findIndex(x => x.id === item.id);
    if (idx >= 0) target[idx] = item;
    else target.push(item);
  }
}
