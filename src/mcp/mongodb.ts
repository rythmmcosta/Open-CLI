import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const mongoTools: ToolDef[] = [
  {
    name: 'mongo_find',
    description: 'Query documents from a MongoDB collection with optional filter, sort, and limit.',
    inputSchema: {
      type: 'object',
      properties: {
        uri:        { type: 'string', description: 'MongoDB connection URI, e.g. mongodb://localhost:27017' },
        db:         { type: 'string', description: 'Database name' },
        collection: { type: 'string', description: 'Collection name' },
        filter:     { type: 'object', description: 'MongoDB query filter (default: {})' },
        limit:      { type: 'number', description: 'Maximum number of documents to return (default: 20)' },
        sort:       { type: 'object', description: 'Sort specification, e.g. {"createdAt": -1}' },
      },
      required: ['uri', 'db', 'collection'],
    },
  },
  {
    name: 'mongo_insert',
    description: 'Insert a single document into a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        uri:        { type: 'string', description: 'MongoDB connection URI' },
        db:         { type: 'string', description: 'Database name' },
        collection: { type: 'string', description: 'Collection name' },
        document:   { type: 'object', description: 'Document to insert' },
      },
      required: ['uri', 'db', 'collection', 'document'],
    },
  },
  {
    name: 'mongo_update',
    description: 'Update documents in a MongoDB collection that match a filter (uses $set). Returns count of modified documents.',
    inputSchema: {
      type: 'object',
      properties: {
        uri:        { type: 'string', description: 'MongoDB connection URI' },
        db:         { type: 'string', description: 'Database name' },
        collection: { type: 'string', description: 'Collection name' },
        filter:     { type: 'object', description: 'Query filter to match documents' },
        update:     { type: 'object', description: 'Fields to set (applied with $set)' },
        upsert:     { type: 'boolean', description: 'Insert if no document matches (default: false)' },
      },
      required: ['uri', 'db', 'collection', 'filter', 'update'],
    },
  },
  {
    name: 'mongo_delete',
    description: 'Delete all documents in a MongoDB collection matching a filter.',
    inputSchema: {
      type: 'object',
      properties: {
        uri:        { type: 'string', description: 'MongoDB connection URI' },
        db:         { type: 'string', description: 'Database name' },
        collection: { type: 'string', description: 'Collection name' },
        filter:     { type: 'object', description: 'Query filter — all matching documents are deleted' },
      },
      required: ['uri', 'db', 'collection', 'filter'],
    },
  },
  {
    name: 'mongo_aggregate',
    description: 'Run a MongoDB aggregation pipeline and return results.',
    inputSchema: {
      type: 'object',
      properties: {
        uri:        { type: 'string', description: 'MongoDB connection URI' },
        db:         { type: 'string', description: 'Database name' },
        collection: { type: 'string', description: 'Collection name' },
        pipeline:   { type: 'array',  description: 'Aggregation pipeline stages, e.g. [{"$match": {...}}, {"$group": {...}}]' },
      },
      required: ['uri', 'db', 'collection', 'pipeline'],
    },
  },
  {
    name: 'mongo_collections',
    description: 'List all collections in a MongoDB database.',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB connection URI' },
        db:  { type: 'string', description: 'Database name' },
      },
      required: ['uri', 'db'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helper — dynamic mongodb require
// ---------------------------------------------------------------------------

interface MongoCollection {
  find(filter: Record<string, unknown>, opts?: Record<string, unknown>): { toArray(): Promise<unknown[]> };
  insertOne(doc: Record<string, unknown>): Promise<{ insertedId: unknown; acknowledged: boolean }>;
  updateMany(filter: Record<string, unknown>, update: Record<string, unknown>, opts?: Record<string, unknown>): Promise<{ modifiedCount: number; upsertedCount: number; acknowledged: boolean }>;
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number; acknowledged: boolean }>;
  aggregate(pipeline: unknown[]): { toArray(): Promise<unknown[]> };
}

interface MongoDb {
  collection(name: string): MongoCollection;
  listCollections(filter?: Record<string, unknown>, opts?: Record<string, unknown>): { toArray(): Promise<Array<{ name: string; type: string }>> };
}

interface MongoClient {
  db(name: string): MongoDb;
  close(): Promise<void>;
}

async function getMongoClient(uri: string): Promise<MongoClient> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MongoClient } = require('mongodb') as {
      MongoClient: { connect(uri: string): Promise<MongoClient> };
    };
    return MongoClient.connect(uri);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Cannot find module')) throw new Error('mongodb not installed. Run: npm install mongodb');
    throw e;
  }
}

function formatDoc(doc: unknown, index: number): string {
  const str = JSON.stringify(doc, null, 2);
  return `--- Document ${index + 1} ---\n${str}`;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeMongoTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  const uri        = input.uri as string;
  const dbName     = input.db  as string;
  const collName   = input.collection as string | undefined;

  let client: MongoClient | undefined;
  try {
    // -----------------------------------------------------------------------
    if (name === 'mongo_find') {
      client = await getMongoClient(uri);
      try {
        const filter = (input.filter as Record<string, unknown> | undefined) || {};
        const limit  = (input.limit  as number  | undefined) ?? 20;
        const sort   = (input.sort   as Record<string, unknown> | undefined) || {};
        const coll   = client.db(dbName).collection(collName as string);
        const docs   = await coll.find(filter, { limit, sort }).toArray();
        if (!docs.length) return { output: 'No documents found.', isError: false };
        const formatted = docs.map(formatDoc).join('\n\n');
        return { output: `Found ${docs.length} document(s):\n\n${formatted}`, isError: false };
      } finally { await client.close(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'mongo_insert') {
      client = await getMongoClient(uri);
      try {
        const document = input.document as Record<string, unknown>;
        const coll     = client.db(dbName).collection(collName as string);
        const result   = await coll.insertOne(document);
        return {
          output: `Document inserted successfully.\n  Inserted ID : ${String(result.insertedId)}\n  Acknowledged: ${result.acknowledged}`,
          isError: false,
        };
      } finally { await client.close(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'mongo_update') {
      client = await getMongoClient(uri);
      try {
        const filter = input.filter as Record<string, unknown>;
        const update = input.update as Record<string, unknown>;
        const upsert = (input.upsert as boolean | undefined) ?? false;
        const coll   = client.db(dbName).collection(collName as string);
        const result = await coll.updateMany(filter, { $set: update }, { upsert });
        return {
          output: [
            `Update complete.`,
            `  Modified  : ${result.modifiedCount}`,
            `  Upserted  : ${result.upsertedCount}`,
            `  Acknowledged: ${result.acknowledged}`,
          ].join('\n'),
          isError: false,
        };
      } finally { await client.close(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'mongo_delete') {
      client = await getMongoClient(uri);
      try {
        const filter = input.filter as Record<string, unknown>;
        const coll   = client.db(dbName).collection(collName as string);
        const result = await coll.deleteMany(filter);
        return {
          output: `Deleted ${result.deletedCount} document(s). Acknowledged: ${result.acknowledged}`,
          isError: false,
        };
      } finally { await client.close(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'mongo_aggregate') {
      client = await getMongoClient(uri);
      try {
        const pipeline = input.pipeline as unknown[];
        const coll     = client.db(dbName).collection(collName as string);
        const docs     = await coll.aggregate(pipeline).toArray();
        if (!docs.length) return { output: 'Aggregation returned no results.', isError: false };
        const formatted = docs.map(formatDoc).join('\n\n');
        return { output: `Aggregation returned ${docs.length} result(s):\n\n${formatted}`, isError: false };
      } finally { await client.close(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'mongo_collections') {
      client = await getMongoClient(uri);
      try {
        const db   = client.db(dbName);
        const list = await db.listCollections({}, { nameOnly: true }).toArray();
        if (!list.length) return { output: `No collections found in database "${dbName}".`, isError: false };
        const lines = list.map((c, i) => `  ${String(i + 1).padStart(3)}. ${c.name}  (${c.type || 'collection'})`);
        return { output: `Collections in "${dbName}" (${list.length}):\n\n${lines.join('\n')}`, isError: false };
      } finally { await client.close(); }
    }

    return { output: `Unknown MongoDB tool: ${name}`, isError: true };
  } catch (err: unknown) {
    if (client) { try { await client.close(); } catch { /* ignore */ } }
    return { output: (err as Error).message, isError: true };
  }
}
