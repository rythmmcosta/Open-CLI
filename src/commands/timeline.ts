// Show file change history and rollback
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { getTimeline, getFileHistory, rollbackFile } from '../db/file-history';
import { getCurrentProject } from '../db/projects';

function formatBytes(n: number | null | undefined): string {
  if (n == null || n < 0) return chalk.dim('—');
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function operationType(
  contentBefore: string | null,
  contentAfter: string | null
): { label: string; colorFn: (s: string) => string } {
  if (!contentBefore && contentAfter !== null) {
    return { label: 'CREATE', colorFn: chalk.green };
  }
  if (contentBefore !== null && !contentAfter) {
    return { label: 'DELETE', colorFn: chalk.red };
  }
  return { label: 'EDIT  ', colorFn: chalk.yellow };
}

export async function showTimeline(filePath?: string): Promise<void> {
  const project = getCurrentProject();

  if (!project) {
    console.log(chalk.dim('\n  No project found for the current directory.\n'));
    return;
  }

  const rows = filePath
    ? getFileHistory(project.id, path.resolve(filePath))
    : getTimeline(project.id, 100);

  if (rows.length === 0) {
    const scope = filePath ? `file "${filePath}"` : 'this project';
    console.log(chalk.dim(`\n  No file history yet for ${scope}.\n`));
    return;
  }

  const heading = filePath
    ? `Timeline: ${path.basename(filePath)}`
    : `Timeline: ${project.name}`;

  console.log(chalk.bold(`\n  ${heading}\n`));

  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Op'),
      chalk.bold('File'),
      chalk.bold('Before'),
      chalk.bold('After'),
      chalk.bold('Changed At'),
    ],
    colWidths: [8, 10, 40, 10, 10, 24],
    style: { head: [], border: ['dim'] },
    wordWrap: true,
  });

  for (const row of rows) {
    const op = operationType(row.content_before, row.content_after);
    const beforeSize = row.content_before != null ? row.content_before.length : null;
    const afterSize = row.content_after != null ? row.content_after.length : null;
    const shortPath = row.file_path.replace(project.path + '/', '');

    table.push([
      chalk.dim(String(row.id)),
      op.colorFn(op.label),
      chalk.cyan(shortPath.slice(0, 38)),
      chalk.dim(formatBytes(beforeSize)),
      formatBytes(afterSize),
      chalk.dim(formatTimestamp(row.created_at)),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.dim(`  ${rows.length} change(s) shown. Use /rollback <id> to restore a version.\n`));
}

export async function doRollback(historyId: number): Promise<void> {
  const result = rollbackFile(historyId);

  if (!result) {
    console.log(chalk.red(`\n  History record #${historyId} not found or has no "before" content.`));
    console.log(chalk.dim('  Only edits (not creates) can be rolled back.\n'));
    return;
  }

  const { filePath, content } = result;

  console.log(chalk.bold('\n  Rollback\n'));
  console.log(chalk.dim(`  File:    ${filePath}`));
  console.log(chalk.dim(`  Size:    ${formatBytes(content.length)} (restored content)`));

  const fileExists = fs.existsSync(filePath);
  if (fileExists) {
    const currentContent = fs.readFileSync(filePath, 'utf8');
    const currentLines = currentContent.split('\n').length;
    const restoredLines = content.split('\n').length;
    console.log(chalk.dim(`  Current: ${currentLines} lines → Restored: ${restoredLines} lines`));
  }

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(`  Overwrite "${path.basename(filePath)}" with history #${historyId}?`),
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.dim('  Rollback cancelled.\n'));
    return;
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(chalk.green(`\n  ✓ Rolled back: ${path.basename(filePath)}\n`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`\n  Rollback failed: ${msg}\n`));
    throw err;
  }
}
