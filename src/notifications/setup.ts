import inquirer from 'inquirer';
import nodeFetch from 'node-fetch';
import { loadNotifyConfig, saveNotifyConfig, getTelegramChatId, sendNotification } from './index';
import { C, showSuccess, showError, showInfo, showWarning } from '../ui/display';
import chalk from 'chalk';

export async function runNotifySetup(): Promise<void> {
  const config = loadNotifyConfig();

  console.log('\n' + C.blue.bold('  🔔 Notification Setup') + '\n');

  showCurrentStatus(config);
  console.log();

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to configure?',
    choices: [
      { name: chalk.hex('#229ed9')('Set up Telegram Bot notifications'), value: 'telegram' },
      { name: chalk.hex('#7289da')('Set up Discord Webhook notifications'), value: 'discord' },
      { name: chalk.hex('#00ff9d')('Test notifications (send a test message)'), value: 'test' },
      { name: chalk.hex('#ffb300')('Toggle Telegram on/off'), value: 'toggle-telegram' },
      { name: chalk.hex('#ffb300')('Toggle Discord on/off'), value: 'toggle-discord' },
      new inquirer.Separator(),
      { name: chalk.hex('#555555')('Back'), value: 'back' },
    ],
  }]);

  if (action === 'back') return;
  if (action === 'telegram') await setupTelegram(config);
  else if (action === 'discord') await setupDiscord(config);
  else if (action === 'test') await testNotifications();
  else if (action === 'toggle-telegram') {
    config.telegram = { ...config.telegram!, enabled: !config.telegram?.enabled };
    saveNotifyConfig(config);
    showSuccess(`Telegram notifications ${config.telegram.enabled ? 'enabled' : 'disabled'}`);
  } else if (action === 'toggle-discord') {
    config.discord = { ...config.discord!, enabled: !config.discord?.enabled };
    saveNotifyConfig(config);
    showSuccess(`Discord notifications ${config.discord.enabled ? 'enabled' : 'disabled'}`);
  }
}

async function setupTelegram(config: ReturnType<typeof loadNotifyConfig>): Promise<void> {
  console.log('\n  ' + C.blue.bold('Telegram Bot Setup') + '\n');
  console.log('  ' + C.dim('Step 1: Create a bot at') + ' ' + chalk.hex('#229ed9')('https://t.me/BotFather'));
  console.log('  ' + C.dim('Step 2: Send /newbot and follow instructions'));
  console.log('  ' + C.dim('Step 3: Copy the bot token'));
  console.log('  ' + C.dim('Step 4: Message your bot first (to get chat ID)'));
  console.log();

  const { botToken } = await inquirer.prompt([{
    type: 'password',
    name: 'botToken',
    message: 'Bot Token (from @BotFather):',
    mask: '●',
    validate: (v: string) => v.includes(':') || 'Invalid token format',
  }]);

  showInfo('Fetching your chat ID... (message your bot first!)');
  const chatId = await getTelegramChatId(botToken);

  if (!chatId) {
    showWarning('Could not auto-detect chat ID. Please send a message to your bot, then try again.');
    const { manualChatId } = await inquirer.prompt([{
      type: 'input',
      name: 'manualChatId',
      message: 'Or enter chat ID manually (find via @userinfobot):',
    }]);
    config.telegram = { botToken, chatId: manualChatId, enabled: true };
  } else {
    config.telegram = { botToken, chatId, enabled: true };
    showSuccess(`Chat ID detected: ${chatId}`);
  }

  saveNotifyConfig(config);
  showSuccess('Telegram configured! Sending test message...');

  const ok = await sendNotification('🎉 Open CLI is connected! You will receive notifications here.', {
    title: 'Setup Complete',
    level: 'success',
    metadata: { 'Source': 'opencli.myowncloud.tech' },
  });

  if (ok.telegram) {
    showSuccess('Test message sent successfully!');
  } else {
    showError('Test message failed. Check your bot token.');
  }
  console.log();
}

async function setupDiscord(config: ReturnType<typeof loadNotifyConfig>): Promise<void> {
  console.log('\n  ' + C.blue.bold('Discord Webhook Setup') + '\n');
  console.log('  ' + C.dim('1. Open your Discord server'));
  console.log('  ' + C.dim('2. Go to channel Settings → Integrations → Webhooks'));
  console.log('  ' + C.dim('3. Create a new webhook and copy the URL'));
  console.log();

  const { webhookUrl } = await inquirer.prompt([{
    type: 'input',
    name: 'webhookUrl',
    message: 'Discord Webhook URL:',
    validate: (v: string) => v.startsWith('https://discord.com/api/webhooks/') || 'Invalid Discord webhook URL',
  }]);

  config.discord = { webhookUrl, enabled: true };
  saveNotifyConfig(config);
  showSuccess('Discord configured! Sending test message...');

  const ok = await sendNotification('🎉 Open CLI is connected! You will receive notifications here.', {
    title: 'Setup Complete',
    level: 'success',
    metadata: { 'Source': 'opencli.myowncloud.tech' },
  });

  if (ok.discord) {
    showSuccess('Test message sent to Discord!');
  } else {
    showError('Discord test failed. Check your webhook URL.');
  }
  console.log();
}

async function testNotifications(): Promise<void> {
  showInfo('Sending test notification...');
  const results = await sendNotification('This is a test notification from Open CLI', {
    title: '🧪 Test Notification',
    level: 'info',
    metadata: {
      'Time': new Date().toLocaleString(),
      'Source': 'opencli.myowncloud.tech',
    },
  });

  if (!results.telegram && !results.discord) {
    showWarning('No notifications sent. Configure Telegram or Discord first.');
  } else {
    if (results.telegram) showSuccess('Telegram: sent');
    if (results.discord) showSuccess('Discord: sent');
  }
  console.log();
}

function showCurrentStatus(config: ReturnType<typeof loadNotifyConfig>): void {
  const tgStatus = config.telegram?.enabled
    ? C.green('● enabled') + C.dim(` (chat: ${config.telegram.chatId})`)
    : config.telegram?.botToken
    ? C.yellow('○ configured but disabled')
    : C.dim('○ not configured');

  const dcStatus = config.discord?.enabled
    ? C.green('● enabled')
    : config.discord?.webhookUrl
    ? C.yellow('○ configured but disabled')
    : C.dim('○ not configured');

  console.log('  ' + chalk.hex('#229ed9')('Telegram'.padEnd(12)) + tgStatus);
  console.log('  ' + chalk.hex('#7289da')('Discord'.padEnd(12)) + dcStatus);
}
