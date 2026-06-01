/**
 * AzureProvider
 *
 * Azure OpenAI Service uses the OpenAI SDK but authenticates with an API key
 * sent in the `api-key` header (not the `Authorization: Bearer` header) and
 * requires an `api-version` query parameter on every request.
 *
 * Constructor parameters:
 *  - apiKey          Azure OpenAI key (from the portal)
 *  - endpoint        Resource endpoint, e.g. https://my-resource.openai.azure.com
 *  - deploymentName  The deployment name (not the model name)
 *  - apiVersion      Defaults to '2024-05-01-preview'
 *
 * The constructed base URL is:
 *   {endpoint}/openai/deployments/{deploymentName}
 * and the OpenAI client appends `/chat/completions` automatically.
 */

import OpenAI from 'openai';
import { OpenAICompatibleProvider } from './openai-compatible';

export class AzureProvider extends OpenAICompatibleProvider {
  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string,
    apiVersion = '2024-05-01-preview',
  ) {
    // Build the deployment-scoped base URL
    const baseUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}`;

    // Call super with a placeholder key — we override the client below
    super(apiKey, baseUrl, 'azure');

    // Re-create the OpenAI client with Azure-specific headers and query params.
    // Azure requires `api-key` header instead of `Authorization: Bearer` and
    // needs `api-version` on every request.
    (this as unknown as { client: OpenAI }).client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });
  }
}

export const AZURE_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'];
