/**
 * BedrockProvider
 *
 * AWS Bedrock Converse API using pure fetch + AWS Signature V4 signing.
 * No AWS SDK is required — only Node.js built-in `crypto`.
 *
 * Currently supports Claude models on Bedrock (non-streaming).
 * The `onText` callback is called once with the full response text.
 *
 * Constructor parameters:
 *  - accessKeyId      AWS access key ID
 *  - secretAccessKey  AWS secret access key
 *  - region           AWS region (default: 'us-east-1')
 */

import { createHmac, createHash } from 'crypto';
import fetch from 'node-fetch';
import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, MessageContent } from '../types';

// ---------------------------------------------------------------------------
// AWS SigV4 implementation
// ---------------------------------------------------------------------------

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSHA256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  const kSigning = hmacSHA256(kService, 'aws4_request');
  return kSigning;
}

interface SignedHeaders {
  Authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256': string;
  host: string;
  'content-type': string;
}

function signRequest(opts: {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  payload: string;
  contentType: string;
}): SignedHeaders {
  const { method, host, path, region, service, accessKeyId, secretAccessKey, payload, contentType } = opts;

  const now = new Date();

  // Format: YYYYMMDDTHHMMSSZ
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  // Format: YYYYMMDD
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(payload);

  // Canonical headers (must be sorted, lowercase, trimmed)
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaderNames = 'content-type;host;x-amz-content-sha256;x-amz-date';

  // Canonical request
  const canonicalRequest = [
    method,
    path,
    '', // no query string
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');

  // Credential scope
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key and signature
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  // Authorization header
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, ` +
    `Signature=${signature}`;

  return {
    Authorization: authorization,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    host,
    'content-type': contentType,
  };
}

// ---------------------------------------------------------------------------
// Bedrock Converse API types
// ---------------------------------------------------------------------------

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: string }>;
}

interface BedrockRequest {
  messages: BedrockMessage[];
  system?: Array<{ type: 'text'; text: string }>;
  inferenceConfig?: { maxTokens?: number };
}

interface BedrockResponse {
  output: {
    message: {
      role: string;
      content: Array<{ type: string; text?: string }>;
    };
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  stopReason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten our Message type into Bedrock's simpler format.
 * Bedrock Converse only supports text content in messages (no tool_use/result
 * natively at the block level for this basic implementation).
 */
function convertBedrockMessage(msg: Message): BedrockMessage {
  let text: string;

  if (typeof msg.content === 'string') {
    text = msg.content;
  } else {
    // Collect text blocks; for tool_result blocks use the content string
    const parts: string[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        parts.push(block.text);
      } else if (block.type === 'tool_result') {
        parts.push(block.content);
      } else if (block.type === 'tool_use') {
        // Represent tool use as a JSON text block for basic compatibility
        parts.push(`[Tool use: ${block.name} ${JSON.stringify(block.input)}]`);
      }
    }
    text = parts.join('\n');
  }

  return {
    role: msg.role,
    content: [{ type: 'text', text }],
  };
}

// ---------------------------------------------------------------------------
// Provider class
// ---------------------------------------------------------------------------

export class BedrockProvider implements Provider {
  readonly name = 'bedrock';
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly sessionToken?: string;

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    region = 'us-east-1',
    sessionToken?: string,
  ) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.sessionToken = sessionToken;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, maxTokens = 4096, onText } = request;

    const host = `bedrock-runtime.${this.region}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(model)}/converse`;
    const url = `https://${host}${path}`;

    const bedrockMessages: BedrockMessage[] = messages.map(convertBedrockMessage);

    const bedrockBody: BedrockRequest = {
      messages: bedrockMessages,
      inferenceConfig: { maxTokens },
    };

    if (system) {
      bedrockBody.system = [{ type: 'text', text: system }];
    }

    const payload = JSON.stringify(bedrockBody);
    const contentType = 'application/json';

    // Sign the request
    const sigHeaders = signRequest({
      method: 'POST',
      host,
      path,
      region: this.region,
      service: 'bedrock',
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payload,
      contentType,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...sigHeaders,
        // `host` header is set automatically by node-fetch; include explicitly
        // for correctness in the signed headers but node-fetch may override it.
        Accept: 'application/json',
      },
      body: payload,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bedrock API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as BedrockResponse;

    const outputContent = data.output.message.content ?? [];
    const text = outputContent
      .filter(c => c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text ?? '')
      .join('');

    // Call the onText callback once with the full text (no streaming)
    if (onText && text) {
      onText(text);
    }

    const rawContent: MessageContent[] = [];
    if (text) rawContent.push({ type: 'text', text });

    const bedrockStopReason = data.stopReason ?? 'end_turn';
    let stopReason: ChatResponse['stopReason'] = 'end_turn';
    if (bedrockStopReason === 'max_tokens') stopReason = 'max_tokens';

    const usage =
      data.usage &&
      (data.usage.inputTokens !== undefined || data.usage.outputTokens !== undefined)
        ? {
            inputTokens: data.usage.inputTokens ?? 0,
            outputTokens: data.usage.outputTokens ?? 0,
          }
        : undefined;

    return {
      text,
      toolCalls: [],
      stopReason,
      usage,
      rawContent,
    };
  }

  async listModels(): Promise<string[]> {
    return BEDROCK_MODELS;
  }
}

export const BEDROCK_MODELS = [
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'amazon.titan-text-express-v1',
];
