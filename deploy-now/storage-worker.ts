import { timingSafeEqual } from 'node:crypto';
import { readBody, RequestError } from '../lib/request-security';

interface StorageEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  CRITOUR_STORAGE_KEY: string;
}

const headers = { 'cache-control': 'no-store' };
const error = (status: number) => new Response(null, { status, headers });

export default {
  async fetch(request: Request, env: StorageEnv): Promise<Response> {
    const key = env.CRITOUR_STORAGE_KEY;
    const supplied = new TextEncoder().encode(request.headers.get('authorization') ?? '');
    const expected = new TextEncoder().encode('Bearer ' + key);
    if (!key || key.length < 32 || supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)) return error(401);

    const url = new URL(request.url);
    try {
      if (url.pathname === '/query' && request.method === 'POST') {
        const body = await readBody(request, 512 * 1024);
        const batch: unknown = JSON.parse(new TextDecoder().decode(body));
        if (!Array.isArray(batch) || batch.length === 0 || batch.length > 100 ||
            !batch.every(query => query && typeof query.sql === 'string' &&
              Array.isArray(query.params) && query.params.every((value: unknown) =>
                value === null || ['string', 'number', 'boolean'].includes(typeof value)))) {
          return error(400);
        }
        const results = await env.DB.batch(batch.map(({ sql, params }) => env.DB.prepare(sql).bind(...params)));
        return Response.json(results, { headers });
      }
      if (url.pathname !== '/object') return error(404);
      const objectKey = url.searchParams.get('key');
      if (!objectKey || objectKey.length > 1024) return error(400);
      if (request.method === 'GET') {
        const object = await env.BUCKET.get(objectKey);
        if (!object) return error(404);
        return new Response(object.body, {
          headers: { ...headers, 'content-type': object.httpMetadata?.contentType || 'application/octet-stream' },
        });
      }
      if (request.method === 'PUT') {
        await env.BUCKET.put(objectKey, await readBody(request, 10 * 1024 * 1024), {
          httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' },
        });
        return new Response(null, { status: 204, headers });
      }
      if (request.method === 'DELETE') {
        await env.BUCKET.delete(objectKey);
        return new Response(null, { status: 204, headers });
      }
      return error(405);
    } catch (cause) {
      if (cause instanceof RequestError) return error(cause.status);
      if (cause instanceof SyntaxError) return error(400);
      return error(502);
    }
  },
};
