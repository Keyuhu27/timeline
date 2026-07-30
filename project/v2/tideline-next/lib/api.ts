// 潮线 Tideline · API 工具层
// 模拟 Next.js route handler 的 Request/Response 约定
// 迁移到真实 Next.js 时：直接把 handler 函数 export 为 GET/POST

import type { ApiResponse } from '../types/index';
import type { Session } from './auth';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type RouteHandler = (
  // session 只在受保护路由（非 PUBLIC_ROUTES）上一定存在，由 server/index.ts 的
  // requireAuth() 结果挂载；公开路由（login/oauth 回调）不挂，handler 里不读它。
  req: IncomingMessage & { query: Record<string, string>; body?: unknown; session?: Session },
  res: TideResponse,
) => Promise<void> | void;

export interface TideResponse extends ServerResponse {
  json: <T>(data: T, status?: number) => void;
}

/** 给 Node http ServerResponse 注入 json() 方法 */
export function enhanceRes(raw: ServerResponse): TideResponse {
  const res = raw as TideResponse;
  res.json = <T>(data: T, status = 200) => {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  };
  return res;
}

/** 从 URL 解析 query string */
export function parseQuery(url: string = ''): Record<string, string> {
  const [, qs = ''] = url.split('?');
  return Object.fromEntries(new URLSearchParams(qs));
}

/** 读取 POST body */
export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/** 标准成功响应 */
export function ok<T>(res: TideResponse, data: T, meta?: { total?: number; page?: number; pageSize?: number }) {
  res.json<ApiResponse<T>>({ data, ...meta });
}

/** 标准错误响应 */
export function err(res: TideResponse, message: string, status = 400) {
  res.json<ApiResponse<never>>({ data: undefined as never, error: message }, status);
}

/** 简单分页 */
export function paginate<T>(items: T[], query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1'));
  const pageSize = Math.min(100, parseInt(query.pageSize ?? '20'));
  const total = items.length;
  const sliced = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: sliced, total, page, pageSize };
}
