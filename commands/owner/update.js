const util = require('util');
const exec = util.promisify(require('child_process').exec);
const config = require('../../config');

module.exports = {
  name: 'update',
  description: 'Updates the bot from the git repository.',
  ownerOnly: true,
  category: 'owner',
  async execute(sock, msg, args, context) {
    const command = args[0] ? args[0].toLowerCase() : 'update';

    try {
      if (command === 'rollback') {
        await handleRollback(sock, msg, args, context);
      } else {
        await handleUpdate(sock, msg, context);
      }
    } catch (e) {
      console.error('[Update Error]', e);
      await context.reply(`❌ Update failed: ${e.message}`);
    }
  },
};

async function handleUpdate(sock, msg, context) {
  await context.react('⏳');
  console.log('[Updater] Fetching updates from origin...');
  await exec('git fetch origin');

  console.log('[Updater] Pulling updates from main...');
  const { stdout: pullOutput } = await exec('git pull origin main');

  if (pullOutput.includes('Already up to date.')) {
    return await context.reply('✅ Bot is already up to date.');
  }

  console.log('[Updater] Getting current version...');
  const { stdout: version } = await exec('git describe --tags --abbrev=0');
  const trimmedVersion = version.trim();

  await context.reply(`✅ Updated successfully to version: ${trimmedVersion}`);
  console.log(`[Updater] Bot updated to ${trimmedVersion}. Restarting...`);
  process.exit(1);
}

async function handleRollback(sock, msg, args, context) {
  const targetVersion = args[1];

  await context.react('⏳');
  console.log('[Updater] Fetching all tags for rollback...');
  await exec('git fetch --all --tags');

  let rollbackVersion;

  if (targetVersion) {
    console.log(`[Updater] Rolling back to specific version: ${targetVersion}`);
    const { stdout: tags } = await exec('git tag -l');
    if (!tags.split('\n').includes(targetVersion)) {
      return await context.reply(`❌ Version ${targetVersion} not found.`);
    }
    rollbackVersion = targetVersion;
  } else {
    console.log('[Updater] Rolling back to previous version...');
    const { stdout: tags } = await exec('git tag -l --sort=-creatordate');
    const tagList = tags.split('\n').filter(t => t);
    if (tagList.length < 2) {
      return await context.reply('❌ No previous version found to rollback to.');
    }
    rollbackVersion = tagList[1];
  }

  console.log(`[Updater] Checking out to version: ${rollbackVersion}`);
  await exec(`git checkout tags/${rollbackVersion} -f`);

  const { stdout: version } = await exec('git describe --tags --abbrev=0');
  const trimmedVersion = version.trim();

  await context.reply(`🔁 Rolled back to version: ${trimmedVersion}`);
  console.log(`[Updater] Rolled back to ${trimmedVersion}. Restarting...`);
  process.exit(1);
}