import 'server-only';

type Query = { sql: string; params: unknown[] };

async function request(path: string, init: RequestInit) {
  const origin = new URL(process.env.CRITOUR_STORAGE_ORIGIN!);
  const key = process.env.CRITOUR_STORAGE_KEY;
  if (!key || key.length < 32 || origin.username || origin.password ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === '127.0.0.1'))) {
    throw new Error('Invalid CritOur storage configuration');
  }
  const headers = new Headers(init.headers);
  headers.set('authorization', 'Bearer ' + key);
  return fetch(new URL(path, origin), {
    ...init, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
  });
}

async function queries(batch: Query[]): Promise<D1Result[]> {
  const result = await request('/query', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch),
  });
  if (!result.ok) throw new Error('CritOur database request failed');
  return result.json();
}

class Statement {
  constructor(readonly sql: string, readonly params: unknown[] = []) {}
  bind(...params: unknown[]) { return new Statement(this.sql, params); }
  async all() { return (await queries([{ sql: this.sql, params: this.params }]))[0]; }
  run() { return this.all(); }
  async first(column?: string) {
    const row = (await this.all()).results[0];
    if (!row) return null;
    return column === undefined ? row : (row as Record<string, unknown>)[column] ?? null;
  }
}

const database = {
  prepare: (sql: string) => new Statement(sql),
  batch: (statements: Statement[]) => queries(statements.map(({ sql, params }) => ({ sql, params }))),
};

function objectPath(key: string) { return '/object?key=' + encodeURIComponent(key); }

const bucket = {
  async get(key: string) {
    const result = await request(objectPath(key), { method: 'GET' });
    if (result.status === 404) return null;
    if (!result.ok) throw new Error('CritOur object read failed');
    return { body: result.body, httpMetadata: { contentType: result.headers.get('content-type') } };
  },
  async put(key: string, body: BodyInit, options?: { httpMetadata?: { contentType?: string } }) {
    const result = await request(objectPath(key), {
      method: 'PUT', body,
      headers: { 'content-type': options?.httpMetadata?.contentType || 'application/octet-stream' },
    });
    if (!result.ok) throw new Error('CritOur object write failed');
  },
  async delete(key: string) {
    if (!(await request(objectPath(key), { method: 'DELETE' })).ok) {
      throw new Error('CritOur object deletion failed');
    }
  },
};

export const env = new Proxy({}, {
  get(_target, name) {
    if (name === 'DB') return database;
    if (name === 'BUCKET') return bucket;
    return typeof name === 'string' ? process.env[name] : undefined;
  },
}) as Cloudflare.Env;
