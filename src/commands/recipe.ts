// CLI Recipe system — save and run multi-step AI workflows
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import {
  createRecipe,
  getRecipe,
  listRecipes,
  deleteRecipe,
  recordRecipeRun,
} from '../db/recipes';
import { RecipeStep } from '../db/types';
import { AppConfig } from '../types';
import { ConversationContext } from '../core/context';
import { runAgent } from '../core/agent';

function formatTimestamp(ms: number | null): string {
  if (!ms) return chalk.dim('never');
  return new Date(ms).toLocaleString();
}

function parseSteps(stepsJson: string): RecipeStep[] {
  try {
    return JSON.parse(stepsJson) as RecipeStep[];
  } catch {
    return [];
  }
}

export async function createRecipeInteractive(): Promise<void> {
  console.log(chalk.bold('\n  Create Recipe\n'));

  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: 'input',
      name: 'name',
      message: chalk.cyan('Recipe name:'),
      validate: (v: string) => v.trim().length > 0 || 'Name is required',
    },
  ]);

  const { description } = await inquirer.prompt<{ description: string }>([
    {
      type: 'input',
      name: 'description',
      message: chalk.cyan('Description') + chalk.dim(' (optional):'),
    },
  ]);

  const steps: RecipeStep[] = [];
  let addingSteps = true;

  console.log(chalk.dim('\n  Add steps to your recipe. Each step runs a prompt via the AI agent.'));

  while (addingSteps) {
    const stepNum = steps.length + 1;
    console.log(chalk.bold(`\n  Step ${stepNum}`));

    const { prompt } = await inquirer.prompt<{ prompt: string }>([
      {
        type: 'input',
        name: 'prompt',
        message: chalk.cyan('  Prompt:'),
        validate: (v: string) => v.trim().length > 0 || 'Prompt is required',
      },
    ]);

    const { skill } = await inquirer.prompt<{ skill: string }>([
      {
        type: 'input',
        name: 'skill',
        message: chalk.cyan('  Skill') + chalk.dim(' (optional, e.g. typescript, react):'),
      },
    ]);

    const { model } = await inquirer.prompt<{ model: string }>([
      {
        type: 'input',
        name: 'model',
        message: chalk.cyan('  Model') + chalk.dim(' (optional, leave blank to use default):'),
      },
    ]);

    steps.push({
      order: stepNum,
      prompt: prompt.trim(),
      skill: skill.trim() || undefined,
      model: model.trim() || undefined,
    });

    console.log(chalk.green(`  ✓ Step ${stepNum} added`));

    const { more } = await inquirer.prompt<{ more: boolean }>([
      {
        type: 'confirm',
        name: 'more',
        message: chalk.cyan('  Add another step?'),
        default: true,
      },
    ]);

    addingSteps = more;
  }

  if (steps.length === 0) {
    console.log(chalk.yellow('\n  No steps added — recipe not saved.'));
    return;
  }

  console.log(chalk.bold('\n  Recipe Summary'));
  console.log(chalk.dim(`  Name: ${name}`));
  if (description.trim()) {
    console.log(chalk.dim(`  Description: ${description.trim()}`));
  }
  console.log(chalk.dim(`  Steps: ${steps.length}`));

  for (const step of steps) {
    const meta: string[] = [];
    if (step.skill) meta.push(`skill: ${step.skill}`);
    if (step.model) meta.push(`model: ${step.model}`);
    const metaStr = meta.length > 0 ? chalk.dim(` (${meta.join(', ')})`) : '';
    console.log(chalk.dim(`    ${step.order}. ${step.prompt.slice(0, 80)}${step.prompt.length > 80 ? '...' : ''}`) + metaStr);
  }

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.cyan('\n  Save this recipe?'),
      default: true,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.dim('  Recipe not saved.'));
    return;
  }

  const id = createRecipe(name.trim(), description.trim() || null, steps);
  console.log(chalk.green(`\n  ✓ Recipe "${name}" saved (id: ${id.slice(0, 8)}...)\n`));
}

export async function runRecipe(
  nameOrId: string,
  config: AppConfig
): Promise<void> {
  const recipe = getRecipe(nameOrId);

  if (!recipe) {
    console.log(chalk.red(`\n  Recipe not found: "${nameOrId}"`));
    console.log(chalk.dim('  Use /recipe list to see available recipes.\n'));
    return;
  }

  const steps = parseSteps(recipe.steps);

  if (steps.length === 0) {
    console.log(chalk.yellow(`\n  Recipe "${recipe.name}" has no steps.\n`));
    return;
  }

  console.log(chalk.bold(`\n  Running Recipe: ${recipe.name}`));
  if (recipe.description) {
    console.log(chalk.dim(`  ${recipe.description}`));
  }
  console.log(chalk.dim(`  ${steps.length} step(s)\n`));

  const runId = recordRecipeRun(recipe.id, 'running');

  try {
    for (const step of steps) {
      const stepConfig: AppConfig = { ...config };

      if (step.model) {
        stepConfig.defaultModel = step.model;
      }

      if (step.skill) {
        stepConfig.activeSkill = step.skill;
      }

      console.log(
        chalk.bold(`  Step ${step.order} / ${steps.length}`) +
        (step.skill ? chalk.dim(` [${step.skill}]`) : '') +
        (step.model ? chalk.dim(` [${step.model}]`) : '')
      );
      console.log(chalk.dim(`  ${step.prompt.slice(0, 120)}${step.prompt.length > 120 ? '...' : ''}\n`));

      const context = new ConversationContext();
      await runAgent(step.prompt, context, stepConfig);

      console.log();
    }

    recordRecipeRun(recipe.id, 'done', `Completed ${steps.length} steps`);
    console.log(chalk.green(`  ✓ Recipe "${recipe.name}" completed\n`));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordRecipeRun(recipe.id, 'error', undefined, errorMsg);
    console.log(chalk.red(`\n  Recipe failed: ${errorMsg}\n`));
    throw err;
  }
}

export async function listRecipesCmd(): Promise<void> {
  const recipes = listRecipes();

  if (recipes.length === 0) {
    console.log(chalk.dim('\n  No recipes yet. Create one with /recipe create\n'));
    return;
  }

  console.log(chalk.bold('\n  Recipes\n'));

  const table = new Table({
    head: [
      chalk.bold('Name'),
      chalk.bold('Description'),
      chalk.bold('Steps'),
      chalk.bold('Last Run'),
      chalk.bold('Runs'),
    ],
    colWidths: [24, 36, 8, 24, 8],
    style: { head: [], border: ['dim'] },
    wordWrap: true,
  });

  for (const recipe of recipes) {
    const steps = parseSteps(recipe.steps);
    table.push([
      chalk.cyan(recipe.name),
      chalk.dim(recipe.description ?? '—'),
      String(steps.length),
      formatTimestamp(recipe.last_run),
      String(recipe.run_count),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.dim(`  ${recipes.length} recipe(s) total\n`));
}

export async function deleteRecipeCmd(nameOrId: string): Promise<void> {
  const recipe = getRecipe(nameOrId);

  if (!recipe) {
    console.log(chalk.red(`\n  Recipe not found: "${nameOrId}"\n`));
    return;
  }

  const steps = parseSteps(recipe.steps);

  console.log(chalk.bold(`\n  Delete Recipe: ${recipe.name}`));
  console.log(chalk.dim(`  Steps: ${steps.length}`));
  if (recipe.run_count > 0) {
    console.log(chalk.dim(`  Run ${recipe.run_count} time(s), last run: ${formatTimestamp(recipe.last_run)}`));
  }

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(`  Delete "${recipe.name}"? This cannot be undone.`),
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.dim('  Delete cancelled.\n'));
    return;
  }

  deleteRecipe(recipe.id);
  console.log(chalk.green(`  ✓ Recipe "${recipe.name}" deleted\n`));
}
