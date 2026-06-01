import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllUsage, getProjectUsage, estimateCost } from '../db/usage';
import { getCurrentProject } from '../db/projects';
import { C, showInfo } from '../ui/display';

export function runCostsCommand(args: string[]): void {
  const days = parseInt(args[0] || '30', 10) || 30;
  const project = getCurrentProject();

  const usage = project
    ? getProjectUsage(project.id, days)
    : getAllUsage(days);

  if (usage.length === 0) {
    showInfo(`No usage data for the last ${days} days.`);
    return;
  }

  console.log('\n  ' + C.blue.bold('💰 AI Cost Dashboard') + C.dim(`  — last ${days} days\n`));

  const table = new Table({
    head: [C.green('Model'), C.blue('Provider'), C.dim('Input Tokens'), C.dim('Output Tokens'), C.green('Est. Cost')],
    style: { head: [], border: ['dim'] },
  });

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const row of usage) {
    const cost = estimateCost(row.model, row.input_tokens, row.output_tokens);
    totalCost += cost;
    totalInput += row.input_tokens;
    totalOutput += row.output_tokens;
    table.push([
      chalk.green(row.model.slice(0, 30)),
      chalk.blue(row.provider),
      row.input_tokens.toLocaleString(),
      row.output_tokens.toLocaleString(),
      cost > 0 ? C.green(`$${cost.toFixed(4)}`) : C.dim('—'),
    ]);
  }

  console.log(table.toString());
  console.log();
  console.log('  ' + C.dim('Totals:'));
  console.log(`    Input:  ${totalInput.toLocaleString()} tokens`);
  console.log(`    Output: ${totalOutput.toLocaleString()} tokens`);
  console.log(`    Cost:   ${totalCost > 0 ? C.green('$' + totalCost.toFixed(4)) : C.dim('$0.00 (free/local models)')}`);
  if (project) {
    console.log(`\n  ${C.dim('Project:')} ${project.name}`);
  }
  console.log();
}
