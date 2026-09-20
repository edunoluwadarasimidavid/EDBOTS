/**
 * @file customize.js
 * @description Interactive Configuration Wizard for EDBots.
 * 
 * Walks the user through all customizable settings.
 * ENTER always preserves the current value.
 */

'use strict';

const logger = require('../ui/logger');
const { ask, askWithDefault, askYesNo, close } = require('../ui/prompts');
const configManager = require('../../config/manager');

async function customize() {
    logger.banner();
    logger.info('Interactive Configuration Wizard\n');
    logger.info('Press ENTER to keep the current value.\n');

    // Load current config
    configManager.load();

    // ─── IDENTITY ───────────────────────────────
    console.log('\x1b[1m\x1b[36m━━━ IDENTITY ━━━\x1b[0m\n');

    const displayName = await askWithDefault(
        'Bot display name',
        configManager.get('bot.displayName')
    );
    configManager.set('bot.displayName', displayName);

    const description = await askWithDefault(
        'Bot description',
        configManager.get('bot.description')
    );
    configManager.set('bot.description', description);

    const prefix = await askWithDefault(
        'Command prefix',
        configManager.get('bot.prefix')
    );
    configManager.set('bot.prefix', prefix);

    const ownerName = await askWithDefault(
        'Owner name',
        configManager.get('owner.name')
    );
    configManager.set('owner.name', ownerName);

    const ownerNumber = await askWithDefault(
        'Owner number (with country code)',
        configManager.get('owner.number')
    );
    configManager.set('owner.number', ownerNumber);

    const timezone = await askWithDefault(
        'Timezone',
        configManager.get('bot.timezone')
    );
    configManager.set('bot.timezone', timezone);

    // ─── MESSAGE BEHAVIOR ──────────────────────
    console.log('\n\x1b[1m\x1b[36m━━━ MESSAGE BEHAVIOR ━━━\x1b[0m\n');

    const autoRead = await askYesNo(
        `Auto-read messages? [${configManager.get('behavior.autoRead') ? 'ON' : 'OFF'}]`,
        configManager.get('behavior.autoRead')
    );
    configManager.set('behavior.autoRead', autoRead);

    const autoTyping = await askYesNo(
        `Auto-typing indicator? [${configManager.get('behavior.autoTyping') ? 'ON' : 'OFF'}]`,
        configManager.get('behavior.autoTyping')
    );
    configManager.set('behavior.autoTyping', autoTyping);

    const autoReact = await askYesNo(
        `Auto-react to messages? [${configManager.get('behavior.autoReact') ? 'ON' : 'OFF'}]`,
        configManager.get('behavior.autoReact')
    );
    configManager.set('behavior.autoReact', autoReact);

    const autoReply = await askYesNo(
        `AI auto-reply? [${configManager.get('behavior.autoReply') ? 'ON' : 'OFF'}]`,
        configManager.get('behavior.autoReply')
    );
    configManager.set('behavior.autoReply', autoReply);

    const selfMode = await askYesNo(
        `Self mode (owner only)? [${configManager.get('behavior.selfMode') ? 'ON' : 'OFF'}]`,
        configManager.get('behavior.selfMode')
    );
    configManager.set('behavior.selfMode', selfMode);

    // ─── GROUP BEHAVIOR ────────────────────────
    console.log('\n\x1b[1m\x1b[36m━━━ GROUP BEHAVIOR ━━━\x1b[0m\n');

    const welcome = await askYesNo(
        `Welcome messages? [${configManager.get('group.welcome') ? 'ON' : 'OFF'}]`,
        configManager.get('group.welcome')
    );
    configManager.set('group.welcome', welcome);

    const goodbye = await askYesNo(
        `Goodbye messages? [${configManager.get('group.goodbye') ? 'ON' : 'OFF'}]`,
        configManager.get('group.goodbye')
    );
    configManager.set('group.goodbye', goodbye);

    const antilink = await askYesNo(
        `Anti-link protection? [${configManager.get('group.antilink') ? 'ON' : 'OFF'}]`,
        configManager.get('group.antilink')
    );
    configManager.set('group.antilink', antilink);

    const antispam = await askYesNo(
        `Anti-spam? [${configManager.get('group.antispam') ? 'ON' : 'OFF'}]`,
        configManager.get('group.antispam')
    );
    configManager.set('group.antispam', antispam);

    // ─── AI ────────────────────────────────────
    console.log('\n\x1b[1m\x1b[36m━━━ AI SETTINGS ━━━\x1b[0m\n');

    const aiEnabled = await askYesNo(
        `AI features enabled? [${configManager.get('ai.enabled') ? 'ON' : 'OFF'}]`,
        configManager.get('ai.enabled')
    );
    configManager.set('ai.enabled', aiEnabled);

    if (aiEnabled) {
        const personality = await askWithDefault(
            'AI personality (friendly/professional/casual)',
            configManager.get('ai.personality')
        );
        configManager.set('ai.personality', personality);
    }

    // ─── SUMMARY ───────────────────────────────
    console.log('\n\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    console.log('\x1b[1m\x1b[36m         EDBots Configuration Summary        \x1b[0m');
    console.log('\x1b[1m\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

    const settings = [
        `Display name:     ${configManager.get('bot.displayName')}`,
        `Description:      ${configManager.get('bot.description')}`,
        `Prefix:           ${configManager.get('bot.prefix')}`,
        `Owner:            ${configManager.get('owner.name') || '(not set)'} (${configManager.get('owner.number') || '(not set)'})`,
        `Timezone:         ${configManager.get('bot.timezone')}`,
        '',
        `Auto-read:        ${configManager.get('behavior.autoRead') ? '✓ ON' : '✗ OFF'}`,
        `Auto-typing:      ${configManager.get('behavior.autoTyping') ? '✓ ON' : '✗ OFF'}`,
        `Auto-react:       ${configManager.get('behavior.autoReact') ? '✓ ON' : '✗ OFF'}`,
        `AI auto-reply:    ${configManager.get('behavior.autoReply') ? '✓ ON' : '✗ OFF'}`,
        `Self mode:        ${configManager.get('behavior.selfMode') ? '✓ ON' : '✗ OFF'}`,
        '',
        `Welcome:          ${configManager.get('group.welcome') ? '✓ ON' : '✗ OFF'}`,
        `Goodbye:          ${configManager.get('group.goodbye') ? '✓ ON' : '✗ OFF'}`,
        `Anti-link:        ${configManager.get('group.antilink') ? '✓ ON' : '✗ OFF'}`,
        `Anti-spam:        ${configManager.get('group.antispam') ? '✓ ON' : '✗ OFF'}`,
        '',
        `AI:               ${configManager.get('ai.enabled') ? '✓ ON' : '✗ OFF'}`,
        `AI Personality:   ${configManager.get('ai.personality')}`,
    ];

    settings.forEach(s => console.log(`  ${s}`));

    console.log('');

    const confirmed = await askYesNo('Save these changes?', true);
    close();

    if (confirmed) {
        configManager.save();
        configManager.syncToLegacy();
        console.log('');
        logger.success('Configuration saved successfully!\n');
        logger.info('Changes will take effect on next bot restart.');
    } else {
        console.log('');
        logger.info('Configuration cancelled. No changes saved.\n');
    }
}

customize().catch(err => {
    logger.error('Customize error:', err.message);
    process.exit(1);
});
