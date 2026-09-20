/**
 * @file update.js
 * @description EDBots update command — check and apply updates.
 * 
 * Usage:
 *   edbots update          Check for updates
 *   edbots update --apply  Apply latest update
 */

'use strict';

const logger = require('../ui/logger');
const { getVersionInfo, updateToLatest } = require('../../../utils/versionManager');

const args = process.argv.slice(3);
const apply = args.includes('--apply');

async function update() {
    logger.banner();
    logger.info('Checking for updates...\n');

    try {
        const info = await getVersionInfo();
        const current = require('../../../bot_version.json');

        console.log(`\x1b[1m  Current version:\x1b[0m v${current.version}`);
        
        if (info.current?.codename) {
            console.log(`\x1b[1m  Codename:\x1b[0m ${info.current.codename}`);
        }

        if (info.gitInfo?.commit) {
            console.log(`\x1b[1m  Commit:\x1b[0m ${info.gitInfo.commit}`);
        }

        console.log('');

        if (info.updateAvailable && info.latestRelease) {
            const latestVer = info.latestRelease.version.replace(/^v/, '');
            logger.info(`\x1b[33mUpdate available: v${latestVer}\x1b[0m`);
            
            if (info.latestRelease.body) {
                console.log('\n  What\'s new:');
                const lines = info.latestRelease.body.split('\n').slice(0, 10);
                lines.forEach(line => console.log(`    ${line}`));
            }

            if (apply) {
                logger.info('\nApplying update...\n');
                const result = await updateToLatest();
                
                if (result.success) {
                    logger.success('Update applied successfully!');
                    logger.info('Restart the bot to apply changes: edbots restart');
                } else {
                    logger.error('Update failed:', result.error);
                }
            } else {
                console.log('\n  To apply: edbots update --apply');
            }
        } else {
            logger.success('You are up to date!');
        }

        console.log('');
    } catch (err) {
        logger.error('Failed to check for updates:', err.message);
    }
}

update();
