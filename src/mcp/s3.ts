import { createHmac, createHash } from 'crypto';
import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const s3Tools: ToolDef[] = [
  {
    name: 's3_list_buckets',
    description: 'List all S3 buckets for the given AWS credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        access_key: { type: 'string', description: 'AWS access key ID' },
        secret_key: { type: 'string', description: 'AWS secret access key' },
        region:     { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['access_key', 'secret_key'],
    },
  },
  {
    name: 's3_list_objects',
    description: 'List objects in an S3 bucket, optionally filtered by prefix.',
    inputSchema: {
      type: 'object',
      properties: {
        access_key: { type: 'string', description: 'AWS access key ID' },
        secret_key: { type: 'string', description: 'AWS secret access key' },
        bucket:     { type: 'string', description: 'S3 bucket name' },
        prefix:     { type: 'string', description: 'Key prefix filter' },
        region:     { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['access_key', 'secret_key', 'bucket'],
    },
  },
  {
    name: 's3_upload',
    description: 'Upload text content to an S3 object.',
    inputSchema: {
      type: 'object',
      properties: {
        access_key: { type: 'string', description: 'AWS access key ID' },
        secret_key: { type: 'string', description: 'AWS secret access key' },
        bucket:     { type: 'string', description: 'S3 bucket name' },
        key:        { type: 'string', description: 'Object key (path)' },
        content:    { type: 'string', description: 'Text content to upload' },
        region:     { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['access_key', 'secret_key', 'bucket', 'key', 'content'],
    },
  },
  {
    name: 's3_download',
    description: 'Download an S3 object and return its text content.',
    inputSchema: {
      type: 'object',
      properties: {
        access_key: { type: 'string', description: 'AWS access key ID' },
        secret_key: { type: 'string', description: 'AWS secret access key' },
        bucket:     { type: 'string', description: 'S3 bucket name' },
        key:        { type: 'string', description: 'Object key (path)' },
        region:     { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['access_key', 'secret_key', 'bucket', 'key'],
    },
  },
  {
    name: 's3_delete',
    description: 'Delete an object from an S3 bucket.',
    inputSchema: {
      type: 'object',
      properties: {
        access_key: { type: 'string', description: 'AWS access key ID' },
        secret_key: { type: 'string', description: 'AWS secret access key' },
        bucket:     { type: 'string', description: 'S3 bucket name' },
        key:        { type: 'string', description: 'Object key (path)' },
        region:     { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['access_key', 'secret_key', 'bucket', 'key'],
    },
  },
  {
    name: 's3_get_url',
    description: 'Get the public URL for an S3 object.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'S3 bucket name' },
        key:    { type: 'string', description: 'Object key (path)' },
        region: { type: 'string', description: 'AWS region (default: us-east-1)' },
      },
      required: ['bucket', 'key'],
    },
  },
];

// ---------------------------------------------------------------------------
// AWS SigV4 helpers (same pattern as src/providers/bedrock.ts)
// ---------------------------------------------------------------------------

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate    = hmacSHA256(`AWS4${secretKey}`, dateStamp);
  const kRegion  = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  return hmacSHA256(kService, 'aws4_request');
}

interface S3SignedHeaders {
  Authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256': string;
  host: string;
}

function signS3Request(opts: {
  method: string;
  host: string;
  path: string;
  queryString: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payload: string;
  extraHeaders?: Record<string, string>;
}): S3SignedHeaders & Record<string, string> {
  const { method, host, path, queryString, region, accessKeyId, secretAccessKey, payload, extraHeaders = {} } = opts;

  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);

  // Build sorted canonical headers including extras
  const rawHeaders: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extraHeaders,
  };
  const sortedKeys = Object.keys(rawHeaders).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${rawHeaders[k]}\n`).join('');
  const signedHeaderNames = sortedKeys.join(';');

  const canonicalRequest = [method, path, queryString, canonicalHeaders, signedHeaderNames, payloadHash].join('\n');
  const credentialScope  = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey       = getSigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature        = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return {
    Authorization:          authorization,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': payloadHash,
    host,
    ...extraHeaders,
  };
}

async function s3Fetch(opts: {
  method: string;
  accessKey: string;
  secretKey: string;
  region: string;
  bucket?: string;
  objectKey?: string;
  queryString?: string;
  payload?: string;
  extraHeaders?: Record<string, string>;
}): Promise<{ status: number; body: string }> {
  const { method, accessKey, secretKey, region, bucket, objectKey, queryString = '', payload = '', extraHeaders } = opts;

  const host = bucket
    ? `${bucket}.s3.${region}.amazonaws.com`
    : `s3.${region}.amazonaws.com`;
  const path = objectKey ? `/${objectKey}` : '/';
  const url  = `https://${host}${path}${queryString ? `?${queryString}` : ''}`;

  const headers = signS3Request({ method, host, path, queryString, region, accessKeyId: accessKey, secretAccessKey: secretKey, payload, extraHeaders });

  const res = await fetch(url, {
    method,
    headers: headers as Record<string, string>,
    body: payload || undefined,
  });
  const body = await res.text();
  return { status: res.status, body };
}

function parseXmlList(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeS3Tool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const accessKey = input.access_key as string | undefined;
    const secretKey = input.secret_key as string | undefined;
    const region    = (input.region as string | undefined) || 'us-east-1';

    // -----------------------------------------------------------------------
    if (name === 's3_get_url') {
      const bucket = input.bucket as string;
      const key    = input.key    as string;
      return { output: `https://${bucket}.s3.${region}.amazonaws.com/${key}`, isError: false };
    }

    if (!accessKey || !secretKey) throw new Error('access_key and secret_key are required');

    // -----------------------------------------------------------------------
    if (name === 's3_list_buckets') {
      const { status, body } = await s3Fetch({ method: 'GET', accessKey, secretKey, region });
      if (status !== 200) throw new Error(`S3 error ${status}: ${body}`);
      const names = parseXmlList(body, 'Name');
      if (!names.length) return { output: 'No buckets found.', isError: false };
      return { output: `S3 Buckets (${names.length}):\n\n${names.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 's3_list_objects') {
      const bucket = input.bucket as string;
      const prefix = (input.prefix as string | undefined) || '';
      const qs = prefix ? `list-type=2&prefix=${encodeURIComponent(prefix)}` : 'list-type=2';
      const { status, body } = await s3Fetch({ method: 'GET', accessKey, secretKey, region, bucket, queryString: qs });
      if (status !== 200) throw new Error(`S3 error ${status}: ${body}`);
      const keys   = parseXmlList(body, 'Key');
      const sizes  = parseXmlList(body, 'Size');
      const dates  = parseXmlList(body, 'LastModified');
      if (!keys.length) return { output: 'No objects found.', isError: false };
      const lines = keys.map((k, i) =>
        `${String(sizes[i] || '?').padStart(12)}  ${(dates[i] || '').slice(0, 10)}  ${k}`
      );
      return { output: `Objects in ${bucket}${prefix ? `/${prefix}` : ''} (${keys.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 's3_upload') {
      const bucket  = input.bucket  as string;
      const key     = input.key     as string;
      const content = input.content as string;
      const { status, body } = await s3Fetch({
        method: 'PUT', accessKey, secretKey, region, bucket,
        objectKey: key, payload: content,
        extraHeaders: { 'content-type': 'text/plain' },
      });
      if (status !== 200) throw new Error(`S3 error ${status}: ${body}`);
      return { output: `Uploaded s3://${bucket}/${key} (${content.length} bytes)`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 's3_download') {
      const bucket = input.bucket as string;
      const key    = input.key    as string;
      const { status, body } = await s3Fetch({ method: 'GET', accessKey, secretKey, region, bucket, objectKey: key });
      if (status !== 200) throw new Error(`S3 error ${status}: ${body}`);
      return { output: body, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 's3_delete') {
      const bucket = input.bucket as string;
      const key    = input.key    as string;
      const { status, body } = await s3Fetch({ method: 'DELETE', accessKey, secretKey, region, bucket, objectKey: key });
      if (status !== 204 && status !== 200) throw new Error(`S3 error ${status}: ${body}`);
      return { output: `Deleted s3://${bucket}/${key}`, isError: false };
    }

    return { output: `Unknown S3 tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
