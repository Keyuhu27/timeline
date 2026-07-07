// 潮线 Tideline · 轻量持久化层
// 只持久化「真实 API 同步来的数据」：本地推账户(a_*)、品牌(b_*)、投放计划(c_*)。
// 优先用 Node 内置 node:sqlite（Node ≥22.5）；不可用时自动降级到 JSON 文件。
// 二者都写到 ./data/ 目录，重启后由 loadPersisted() 注水回内存数组。

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { brands, accounts, adCampaigns, dailyReports, externalReports } from './db';
import { tokenManager } from './adapters/token-manager';
import type { Brand, Account, AdCampaign, PlatformCredential, DailyReport, ExternalReport } from '../types/index';

const require_ = createRequire(import.meta.url);

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH  = join(DATA_DIR, 'tideline.db');
const JSON_PATH = join(DATA_DIR, 'store.json');

interface Snapshot {
  brands: Brand[];
  accounts: Account[];
  adCampaigns: AdCampaign[];
  dailyReports: DailyReport[];
  externalReports: ExternalReport[];
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

function kvPut(key: string, value: string) {
  if (backend === 'sqlite' && sqlite) {
    sqlite.prepare(`INSERT INTO kv(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value);
  } else {
    const cur = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf8')) : {};
    cur[key] = JSON.parse(value);
    writeFileSync(JSON_PATH, JSON.stringify(cur, null, 2));
  }
}

function kvGet(key: string): string | null {
  if (backend === 'sqlite' && sqlite) {
    const row = sqlite.prepare(`SELECT value FROM kv WHERE key=?`).all(key) as Array<{ value: string }>;
    return row[0]?.value ?? null;
  }
  if (existsSync(JSON_PATH)) {
    const cur = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
    return cur[key] != null ? JSON.stringify(cur[key]) : null;
  }
  return null;
}

function writeSnapshot(snap: Snapshot) {
  kvPut('brands',       JSON.stringify(snap.brands));
  kvPut('accounts',     JSON.stringify(snap.accounts));
  kvPut('adCampaigns',  JSON.stringify(snap.adCampaigns));
  kvPut('dailyReports', JSON.stringify(snap.dailyReports));
  kvPut('externalReports', JSON.stringify(snap.externalReports));
}

function readSnapshot(): Snapshot | null {
  try {
    const b = kvGet('brands'), a = kvGet('accounts'), c = kvGet('adCampaigns'), d = kvGet('dailyReports'), e = kvGet('externalReports');
    if (!b && !a && !c && !d && !e) return null;
    return {
      brands:       JSON.parse(b ?? '[]'),
      accounts:     JSON.parse(a ?? '[]'),
      adCampaigns:  JSON.parse(c ?? '[]'),
      dailyReports: JSON.parse(d ?? '[]'),
      externalReports: JSON.parse(e ?? '[]'),
    };
  } catch (e) {
    console.error('[Persist] 读取快照失败:', String(e));
  }
  return null;
}

// ─── OAuth 凭证持久化 ─────────────────────────────────────────────────────────
// token 不再写入 .env（避免 git pull 冲突），改存数据库；启动时注册回 tokenManager。

/** 把 tokenManager 当前所有凭证写盘 */
export function saveCredentials(): void {
  if (!ready) return;
  try {
    const creds = tokenManager.getAllCredentials();
    kvPut('credentials', JSON.stringify(creds));
    console.log(`[Persist] 🔑 已保存 ${creds.length} 个 OAuth 凭证`);
  } catch (e) {
    console.error('[Persist] 保存凭证失败:', String(e));
  }
}

function loadCredentials(): void {
  try {
    const raw = kvGet('credentials');
    if (!raw) return;
    const creds = JSON.parse(raw) as PlatformCredential[];
    for (const c of creds) tokenManager.register(c);
    console.log(`[Persist] 🔑 已注册 ${creds.length} 个持久化 OAuth 凭证`);
  } catch (e) {
    console.error('[Persist] 加载凭证失败:', String(e));
  }
}

// ─── 对外 API ─────────────────────────────────────────────────────────────────

let ready = false;

/** 启动时调用：初始化后端并把持久化的真实数据注水回内存数组 */
export function loadPersisted(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch { /* ignore */ }

  if (!initSqlite()) backend = 'json';
  ready = true;

  // 注册持久化的 OAuth 凭证，并挂上「刷新后自动回写」钩子
  loadCredentials();
  tokenManager.persistHook = saveCredentials;

  const snap = readSnapshot();
  if (snap) {
    upsertAll(brands,       snap.brands);
    upsertAll(accounts,     snap.accounts);
    upsertAll(adCampaigns,  snap.adCampaigns);
    upsertAll(dailyReports, snap.dailyReports ?? []);
    upsertAll(externalReports, snap.externalReports ?? []);
    console.log(`[Persist] ✅ 已注水 (${backend}): 账户 ${snap.accounts.length}、品牌 ${snap.brands.length}、计划 ${snap.adCampaigns.length}、日报 ${(snap.dailyReports ?? []).length}`);
  } else {
    console.log(`[Persist] 后端=${backend}，暂无历史快照`);
  }
}

/** 同步完成后调用：把当前「真实同步数据」写盘 */
export function saveSnapshot(): void {
  if (!ready) return;
  // 只持久化 API 同步产生的实体（id/前缀区分于 mock 种子）
  const realBrands   = brands.filter(b => b.id.startsWith('b_'));
  const realAccounts = accounts.filter(a => a.id.startsWith('a_'));
  const realCamps    = adCampaigns.filter(c => !!c.externalId);
  try {
    writeSnapshot({ brands: realBrands, accounts: realAccounts, adCampaigns: realCamps, dailyReports, externalReports });
    console.log(`[Persist] 💾 已保存 (${backend}): 账户 ${realAccounts.length}、计划 ${realCamps.length}、日报 ${dailyReports.length}`);
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
