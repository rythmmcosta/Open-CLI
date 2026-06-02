import { ToolDef } from '../types';
import { shellToolDef, executeBash } from './shell';
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, readFile, writeFile, listFiles, searchFiles } from './filesystem';
import { gitToolDef, executeGit } from './git';
import { ALL_BROWSER_TOOLS, executeBrowserTool } from '../browser/tools';
import { httpTools, executeHttpRequest } from '../mcp/http';
import { databaseTools, executeDatabaseTool } from '../mcp/database';
import { dockerTools, executeDockerTool } from '../mcp/docker';
import { searchTools, executeSearchTool } from '../mcp/search';
import { githubTools, executeGithubTool } from '../mcp/github';
import { emailTools, executeEmailTool } from '../mcp/email';
import { redisTools, executeRedisTool } from '../mcp/redis-mcp';
import { postgresTools, executePostgresTool } from '../mcp/postgres';
import { mongoTools, executeMongoTool } from '../mcp/mongodb';
import { slackTools, executeSlackTool } from '../mcp/slack';
import { clipboardTools, executeClipboardTool } from '../mcp/clipboard';
import { pdfTools, executePdfTool } from '../mcp/pdf';
import { csvTools, executeCsvTool } from '../mcp/csv-tools';
import { jiraTools, executeJiraTool } from '../mcp/jira';
import { gdriveTools, executeGdriveTool } from '../mcp/google-drive';
import { ftpTools, executeFtpTool } from '../mcp/ftp';
import { s3Tools, executeS3Tool } from '../mcp/s3';
import { dropboxTools, executeDropboxTool } from '../mcp/dropbox';
import { notionTools, executeNotionTool } from '../mcp/notion';
import { linearTools, executeLinearTool } from '../mcp/linear';
import { stripeTools, executeStripeTool } from '../mcp/stripe';
import { supabaseTools, executeSupabaseTool } from '../mcp/supabase';

export const ALL_TOOLS: ToolDef[] = [
  shellToolDef,
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  gitToolDef,
  ...httpTools,
  ...databaseTools,
  ...dockerTools,
  ...searchTools,
  ...githubTools,
  ...emailTools,
  ...redisTools,
  ...postgresTools,
  ...mongoTools,
  ...slackTools,
  ...clipboardTools,
  ...pdfTools,
  ...csvTools,
  ...jiraTools,
  ...gdriveTools,
  ...ftpTools,
  ...s3Tools,
  ...dropboxTools,
  ...notionTools,
  ...linearTools,
  ...stripeTools,
  ...supabaseTools,
];

export const BROWSER_ENABLED_TOOLS: ToolDef[] = [
  ...ALL_TOOLS,
  ...ALL_BROWSER_TOOLS,
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  dryRun = false
): Promise<{ output: string; isError: boolean; diffPreview?: string }> {
  // Browser tools
  if (name.startsWith('browser_')) {
    return executeBrowserTool(name, input);
  }

  // HTTP tools
  if (name === 'http_request') {
    return executeHttpRequest(input);
  }

  // Database (SQLite) tools
  if (name.startsWith('db_')) {
    return executeDatabaseTool(name, input);
  }

  // Docker tools
  if (name.startsWith('docker_')) {
    return executeDockerTool(name, input);
  }

  // Web search / fetch
  if (name === 'web_search' || name === 'fetch_page') {
    return executeSearchTool(name, input);
  }

  // GitHub MCP tools
  if (name.startsWith('github_')) {
    return executeGithubTool(name, input);
  }

  // Email tools
  if (name.startsWith('email_')) {
    return executeEmailTool(name, input);
  }

  // Redis tools
  if (name.startsWith('redis_')) {
    return executeRedisTool(name, input);
  }

  // PostgreSQL tools
  if (name.startsWith('pg_')) {
    return executePostgresTool(name, input);
  }

  // MongoDB tools
  if (name.startsWith('mongo_')) {
    return executeMongoTool(name, input);
  }

  // Slack tools
  if (name.startsWith('slack_')) {
    return executeSlackTool(name, input);
  }

  // Clipboard tools
  if (name.startsWith('clipboard_')) {
    return executeClipboardTool(name, input);
  }

  // PDF tools
  if (name.startsWith('pdf_')) {
    return executePdfTool(name, input);
  }

  // CSV tools
  if (name.startsWith('csv_')) {
    return executeCsvTool(name, input);
  }

  // Jira tools
  if (name.startsWith('jira_')) {
    return executeJiraTool(name, input);
  }

  // Google Drive tools
  if (name.startsWith('gdrive_')) {
    return executeGdriveTool(name, input);
  }

  // FTP tools
  if (name.startsWith('ftp_')) {
    return executeFtpTool(name, input);
  }

  // S3 tools
  if (name.startsWith('s3_')) {
    return executeS3Tool(name, input);
  }

  // Dropbox tools
  if (name.startsWith('dropbox_')) {
    return executeDropboxTool(name, input);
  }

  // Notion tools
  if (name.startsWith('notion_')) {
    return executeNotionTool(name, input);
  }

  // Linear tools
  if (name.startsWith('linear_')) {
    return executeLinearTool(name, input);
  }

  // Stripe tools
  if (name.startsWith('stripe_')) {
    return executeStripeTool(name, input);
  }

  // Supabase tools
  if (name.startsWith('supabase_')) {
    return executeSupabaseTool(name, input);
  }

  switch (name) {
    case 'bash':
      if (dryRun) return { output: `[DRY RUN] Would execute: ${input.command}`, isError: false };
      return executeBash(input);

    case 'read_file':
      return readFile(input);

    case 'write_file':
      return writeFile(input, dryRun);

    case 'list_files':
      return listFiles(input);

    case 'search_files':
      return searchFiles(input);

    case 'git_command':
      if (dryRun) return { output: `[DRY RUN] Would run: git ${input.args}`, isError: false };
      return executeGit(input);

    default:
      return { output: `Unknown tool: ${name}`, isError: true };
  }
}
