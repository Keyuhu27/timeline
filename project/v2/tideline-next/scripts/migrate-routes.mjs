#!/usr/bin/env node
// scripts/migrate-routes.mjs
// 把 app/api/**/route.ts 中的自定义 RouteHandler 语法
// 批量转换为 Next.js App Router route handler 语法
//
// 使用: node scripts/migrate-routes.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function findRoutes(dir) {
  const entries = readdirSync(dir);
  const result = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...findRoutes(full));
    } else if (entry === 'route.ts') {
      result.push(full);
    }
  }
  return result;
}

const routes = findRoutes(join(ROOT, 'app'));
console.log(`找到 ${routes.length} 个 route 文件\n`);

for (const filePath of routes) {
  const original = readFileSync(filePath, 'utf-8');
  let code = original;

  // 1. 去掉自定义 lib/api 的 import（ok/err/paginate/RouteHandler）
  code = code.replace(/import \{[^}]+\} from ['"]\.\.\/\.\.\/lib\/api\.js['"];?\n?/g, '');
  code = code.replace(/import type \{[^}]+RouteHandler[^}]*\} from ['"]\.\.\/\.\.\/lib\/api\.js['"];?\n?/g, '');
  code = code.replace(/import \{[^}]+\} from ['"]\.\.\/\.\.\/\.\.\/lib\/api\.js['"];?\n?/g, '');
  code = code.replace(/import type \{[^}]+RouteHandler[^}]*\} from ['"]\.\.\/\.\.\/\.\.\/lib\/api\.js['"];?\n?/g, '');

  // 2. 调整 db/auth import 路径（从相对路径改为 @/ 别名）
  code = code.replace(/from ['"]\.\.\/\.\.\/lib\//g, "from '@/lib/");
  code = code.replace(/from ['"]\.\.\/\.\.\/\.\.\/lib\//g, "from '@/lib/");
  code = code.replace(/from ['"]\.\.\/\.\.\/types\//g, "from '@/types/");

  // 3. 添加 Next.js 必要 import
  if (!code.includes('next/server')) {
    code = `import { NextRequest, NextResponse } from 'next/server';\n` + code;
  }

  // 4. 转换 GET/POST/PATCH handler 签名
  // export const GET: RouteHandler = (req, res) => {  →  export async function GET(req: NextRequest) {
  code = code.replace(
    /export const (GET|POST|PATCH|DELETE): RouteHandler = (?:async )?\(req, res\) => \{/g,
    'export async function $1(req: NextRequest) {\n  // TODO: migrate ok()/err() calls to NextResponse.json()'
  );

  // 5. 转换 ok(res, data) → return NextResponse.json({ data })
  code = code.replace(/\bok\(res,\s*([^,)]+)(?:,\s*(\{[^}]+\}))?\)/g, (_, data, meta) => {
    if (meta) return `return NextResponse.json({ data: ${data}, ...${meta} })`;
    return `return NextResponse.json({ data: ${data} })`;
  });

  // 6. 转换 err(res, msg, status?) → return NextResponse.json({ error: msg }, { status })
  code = code.replace(/\berr\(res,\s*([^,)]+)(?:,\s*(\d+))?\)/g, (_, msg, status) => {
    const s = status ?? '400';
    return `return NextResponse.json({ error: ${msg} }, { status: ${s} })`;
  });

  // 7. req.query → Object.fromEntries(req.nextUrl.searchParams)
  if (code.includes('req.query')) {
    code = code.replace(
      /const \{ ([^}]+) \} = req\.query;/g,
      'const { $1 } = Object.fromEntries(req.nextUrl.searchParams);'
    );
    code = code.replace(/req\.query/g, 'Object.fromEntries(req.nextUrl.searchParams)');
  }

  // 8. req.body → await req.json()
  if (code.includes('req.body')) {
    code = code.replace(/req\.body as/g, '(await req.json()) as');
    code = code.replace(/req\.body/g, 'await req.json()');
  }

  if (code !== original) {
    writeFileSync(filePath, code, 'utf-8');
    console.log(`✓ 已转换: ${filePath.replace(ROOT, '.')}`);
  } else {
    console.log(`- 无需转换: ${filePath.replace(ROOT, '.')}`);
  }
}

console.log('\n转换完成！接下来：');
console.log('1. npm install next');
console.log('2. 手动检查每个 route.ts 中带 TODO 的行');
console.log('3. npx next dev');
