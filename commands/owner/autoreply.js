/**
 * Auto-reply Toggle Command
 * Enables AI auto-reply. On "on": generates the Puter popup link and
 * waits for the user to finish login — then confirms automatically.
 */

const config = require('../../config');
const fs = require('fs');
const path = require('path');
const smartAutoReply = require('../../utils/smartAutoReply');
const { startAuthSession, clearConnection, getLinkStatus, waitForToken } = require('../../utils/puterAI');

module.exports = {
  name: 'auto-reply',
  aliases: ['autoreply', 'ai-auto'],
  description: 'Enable/disable AI auto-reply with a public authentication link',
  usage: '.auto-reply <on/off>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) {
        const status = getLinkStatus();
        return extra.reply(
          `🤖 *AI Auto Reply*\n\n` +
          `Status: *${config.autoReply ? 'ON' : 'OFF'}*\n` +
          `Puter: ${status.linked ? '✅ linked' : '❌ not linked'}\n\n` +
          `Usage:\n` +
          `  .auto-reply on - Enable (creates Puter popup link)\n` +
          `  .auto-reply off - Disable`
        );
      }

      const toggle = args[0].toLowerCase();

      if (toggle === 'on') {
        if (config.autoReply) {
          return extra.reply('✅ AI Auto Reply is already *ON*.');
        }

        // Ensure the chat's smart auto-reply is enabled too
        smartAutoReply.enable(extra.from);

        const status = getLinkStatus();

        // Already linked → just switch on
        if (status.linked) {
          updateConfig('autoReply', true);
          config.autoReply = true;
          return extra.reply(
            `✅ *AI Auto Reply enabled!*\n\n` +
            `☁️ Puter account: linked\n` +
            `🧠 All AI features are active.\n\n` +
            `Customize keywords: \`.autoreply add <word> <response>\``
          );
        }

        await extra.reply(
          `⏳ *AI Auto Reply Setup*\n\n` +
          `Creating your Puter popup link… (10-30s)`
        );

        let session;
        try {
          session = await startAuthSession({ chatId: extra.from });
        } catch (err) {
          return extra.reply(
            `❌ Could not create the popup link (${err.message}).\n` +
            `Auto-reply is enabled with keyword matching only. ` +
            `Try \`.puter link\` later for AI replies.`
          );
        }

        await extra.reply(
          `🔐 *One more step — link your free Puter account:*\n\n` +
          `👉 ${session.url}\n\n` +
          `Tap the link → sign up/log in → return here.\n` +
          `⏳ *Waiting…* I'll confirm automatically when you're done.`
        );

        // Wait for the user to complete login (auto-confirms)
        const result = await waitForToken(300000);

        updateConfig('autoReply', true);
        config.autoReply = true;

        if (result === 'linked') {
          return extra.reply(
            `✅ *All Set!*\n\n` +
            `☁️ Puter account linked\n` +
            `🤖 AI Auto Reply: ON\n` +
            `🧠 Smart keyword + AI responses active\n\n` +
            `Add custom keywords: \`.autoreply add <word> <response>\``
          );
        }

        return extra.reply(
          `✅ *AI Auto Reply enabled!*\n\n` +
          `⚠️ Puter link timed out — run \`.puter link\` when ready for AI-powered replies.\n` +
          `Keyword-based replies are active now.`
        );
      }

      if (toggle === 'off') {
        if (!config.autoReply) {
          return extra.reply('❌ AI Auto Reply is already *OFF*.');
        }

        smartAutoReply.disable(extra.from);
        clearConnection();
        updateConfig('autoReply', false);
        config.autoReply = false;
        return extra.reply('❌ AI Auto Reply has been disabled.');
      }

      return extra.reply('❌ Invalid argument!\nUsage: .auto-reply <on/off>');

    } catch (error) {
      console.error('Auto-reply command error:', error);
      await extra.reply('❌ Error toggling AI auto-reply.');
    }
  }
};

function updateConfig(key, value) {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');

    const regex = new RegExp(`(${key}:\\s*)(true|false)`, 'g');
    configContent = configContent.replace(regex, `$1${value}`);

    fs.writeFileSync(configPath, configContent, 'utf8');

    delete require.cache[require.resolve('../../config')];
  } catch (error) {
    console.error('Error saving config:', error);
  }
}
