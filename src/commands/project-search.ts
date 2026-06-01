import chalk from 'chalk';
import Table from 'cli-table3';
import { searchAllHistory } from '../db/search';
import { C, showError, showInfo } from '../ui/display';

export function runProjectSearchCommand(args: string[]): void {
  const query = args.join(' ').trim();
  if (!query) {
    showError('Usage: /search <query>');
    showInfo('Searches message history across all projects');
    return;
  }

  const results = searchAllHistory(query, 20);

  if (results.length === 0) {
    showInfo(`No results found for "${query}"`);
    return;
  }

  console.log('\n  ' + C.blue.bold(`🔍 Search: "${query}"`) + C.dim(`  — ${results.length} results\n`));

  const table = new Table({
    head: [C.green('Project'), C.blue('Message'), C.dim('Date')],
    style: { head: [], border: ['dim'] },
    colWidths: [20, 55, 14],
    wordWrap: true,
  });

  for (const r of results) {
    const content = typeof r.content === 'string'
      ? r.content
      : JSON.stringify(r.content);
    const preview = content.slice(0, 100).replace(/\n/g, ' ') + (content.length > 100 ? '…' : '');
    table.push([
      chalk.green((r.project_name || 'unknown').slice(0, 18)),
      preview,
      new Date(r.created_at).toLocaleDateString(),
    ]);
  }

  console.log(table.toString());
  console.log();
}
