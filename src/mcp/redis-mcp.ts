import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const redisTools: ToolDef[] = [
  {
    name: 'redis_get',
    description: 'Get the value of a Redis key.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
        key: { type: 'string', description: 'Key to retrieve' },
      },
      required: ['key'],
    },
  },
  {
    name: 'redis_set',
    description: 'Set a Redis key to a value, optionally with a TTL in seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        url:   { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
        key:   { type: 'string', description: 'Key to set' },
        value: { type: 'string', description: 'Value to store' },
        ttl:   { type: 'number', description: 'Time-to-live in seconds (optional)' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'redis_del',
    description: 'Delete one or more Redis keys.',
    inputSchema: {
      type: 'object',
      properties: {
        url:  { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
        keys: { type: 'array', items: { type: 'string' }, description: 'Keys to delete' },
      },
      required: ['keys'],
    },
  },
  {
    name: 'redis_keys',
    description: 'List Redis keys matching a pattern. WARNING: Use only in development — KEYS blocks the server.',
    inputSchema: {
      type: 'object',
      properties: {
        url:     { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
        pattern: { type: 'string', description: "Pattern to match (default: '*')" },
      },
    },
  },
  {
    name: 'redis_ping',
    description: 'Ping a Redis server to check if it is reachable.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
      },
    },
  },
  {
    name: 'redis_info',
    description: "Get Redis server INFO statistics (sections: 'all', 'server', 'clients', 'memory').",
    inputSchema: {
      type: 'object',
      properties: {
        url:     { type: 'string', description: 'Redis URL (default: redis://localhost:6379)' },
        section: { type: 'string', description: "Info section: 'all' | 'server' | 'clients' | 'memory' (default: 'all')" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Helper — dynamic ioredis require
// ---------------------------------------------------------------------------

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK'>;
  set(key: string, value: string, exFlag: 'EX', seconds: number): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ping(): Promise<string>;
  info(section?: string): Promise<string>;
  quit(): Promise<'OK'>;
}

async function getRedis(url = 'redis://localhost:6379'): Promise<RedisClient> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis') as new (url: string, opts?: unknown) => RedisClient;
    return new Redis(url, { lazyConnect: false, enableReadyCheck: false });
  } catch {
    throw new Error('ioredis not installed. Run: npm install ioredis');
  }
}

function redisUrl(input: Record<string, unknown>): string {
  return (input.url as string | undefined) || 'redis://localhost:6379';
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeRedisTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  const url = redisUrl(input);
  let redis: RedisClient | undefined;

  try {
    // -----------------------------------------------------------------------
    if (name === 'redis_get') {
      redis = await getRedis(url);
      const value = await redis.get(input.key as string);
      await redis.quit();
      return {
        output: value === null
          ? `Key "${input.key}" does not exist (nil).`
          : `${input.key}\n${'─'.repeat(40)}\n${value}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'redis_set') {
      redis = await getRedis(url);
      const key   = input.key   as string;
      const value = input.value as string;
      const ttl   = input.ttl   as number | undefined;
      if (ttl) {
        await redis.set(key, value, 'EX', ttl);
      } else {
        await redis.set(key, value);
      }
      await redis.quit();
      return {
        output: `OK — key "${key}" set${ttl ? ` (expires in ${ttl}s)` : ''}.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'redis_del') {
      redis = await getRedis(url);
      const keys = input.keys as string[];
      const count = await redis.del(...keys);
      await redis.quit();
      return {
        output: `Deleted ${count} key(s) out of ${keys.length} requested.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'redis_keys') {
      redis = await getRedis(url);
      const pattern = (input.pattern as string | undefined) || '*';
      const keys = await redis.keys(pattern);
      await redis.quit();
      if (!keys.length) return { output: `No keys match pattern: ${pattern}`, isError: false };
      const sorted = [...keys].sort();
      return {
        output: `Keys matching "${pattern}" (${sorted.length}):\n\n${sorted.join('\n')}\n\nWARNING: KEYS blocks the Redis server — avoid on production.`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'redis_ping') {
      redis = await getRedis(url);
      const result = await redis.ping();
      await redis.quit();
      return { output: `PONG — Redis at ${url} is reachable. Response: ${result}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'redis_info') {
      redis = await getRedis(url);
      const section = (input.section as string | undefined) || 'all';
      const info = section === 'all'
        ? await redis.info()
        : await redis.info(section);
      await redis.quit();
      return { output: `Redis INFO [${section}]:\n\n${info}`, isError: false };
    }

    return { output: `Unknown Redis tool: ${name}`, isError: true };
  } catch (err: unknown) {
    if (redis) {
      try { await redis.quit(); } catch { /* ignore */ }
    }
    return { output: (err as Error).message, isError: true };
  }
}
