import chalk from 'chalk';
import Table from 'cli-table3';
import {
  listProjects, getCurrentProject, upsertProject, deleteProject, updateProject
} from '../db/projects';
import { listSessions } from '../db/sessions';
import { getGithubConnection } from '../db/github-connections';
import { C, showSuccess, showError, showInfo } from '../ui/display';

export function runProjectCommand(args: string[]): void {
  const sub = args[0] || 'status';

  if (sub === 'status' || sub === 'info') {
    const project = getCurrentProject();
    if (!project) {
      showInfo('No project detected in current directory.');
      showInfo('Run: /project init — to register this directory as a project');
      return;
    }
    console.log('\n  ' + C.blue.bold('📁 Current Project') + '\n');
    console.log(`  ${C.dim('Name:')}    ${chalk.bold(project.name)}`);
    console.log(`  ${C.dim('Path:')}    ${project.path}`);
    console.log(`  ${C.dim('Stack:')}   ${project.tech_stack || 'unknown'}`);
    console.log(`  ${C.dim('Created:')} ${new Date(project.created_at).toLocaleDateString()}`);
    if (project.description) console.log(`  ${C.dim('Notes:')}   ${project.description}`);

    const conn = getGithubConnection(project.id);
    if (conn) {
      console.log(`  ${C.dim('GitHub:')}  ${conn.owner}/${conn.repo} (${conn.branch})`);
    }

    const sessions = listSessions(project.id, 5);
    if (sessions.length > 0) {
      console.log(`\n  ${C.dim('Recent Sessions:')}`);
      for (const s of sessions) {
        console.log(`    ${new Date(s.started_at).toLocaleString()}  ${C.dim(s.model)}  ${C.dim(s.msg_count + ' msgs')}`);
      }
    }
    console.log();
    return;
  }

  if (sub === 'init') {
    const project = upsertProject(process.cwd());
    showSuccess(`Project registered: ${project.name}`);
    console.log(`  ${C.dim('Tech stack:')} ${project.tech_stack || 'not detected'}`);
    return;
  }

  if (sub === 'list') {
    const projects = listProjects();
    if (projects.length === 0) {
      showInfo('No projects yet. Navigate to a project dir and run /project init');
      return;
    }
    const table = new Table({
      head: [C.green('Name'), C.blue('Path'), C.dim('Stack'), C.dim('Sessions')],
      style: { head: [], border: ['dim'] },
    });
    for (const p of projects) {
      table.push([
        chalk.green(p.name.slice(0, 20)),
        p.path.slice(0, 35),
        (p.tech_stack || '').slice(0, 20),
        listSessions(p.id, 1000).length.toString(),
      ]);
    }
    console.log('\n' + C.blue.bold('  📁 Projects') + '\n');
    console.log(table.toString());
    console.log();
    return;
  }

  if (sub === 'note') {
    const project = getCurrentProject();
    if (!project) { showError('No project in current directory. Run /project init first.'); return; }
    const note = args.slice(1).join(' ');
    if (!note) { showError('Usage: /project note <text>'); return; }
    updateProject(project.id, { description: note });
    showSuccess('Project note updated');
    return;
  }

  if (sub === 'delete') {
    const project = getCurrentProject();
    if (!project) { showError('No project in current directory.'); return; }
    deleteProject(project.id);
    showSuccess(`Project "${project.name}" removed from database`);
    return;
  }

  showInfo('Usage: /project [status|init|list|note <text>|delete]');
}
