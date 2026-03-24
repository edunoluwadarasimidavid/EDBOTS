/**
 * @file commandLoader.js
 * @description Robust, recursive command loader for EDBOTS.
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively find all .js files in a directory.
 */
const getAllFiles = (dirPath, arrayOfFiles) => {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else if (file.endsWith('.js')) {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
};

/**
 * Loads all commands from the commands directory.
 */
const loadCommands = () => {
    const commands = new Map();
    const commandsPath = path.join(__dirname, '..', 'commands');

    if (!fs.existsSync(commandsPath)) {
        console.warn('\x1b[33m[SYSTEM] Commands directory missing.\x1b[0m');
        return commands;
    }

    const commandFiles = getAllFiles(commandsPath);
    let count = 0;
    const skipped = [];

    commandFiles.forEach(filePath => {
        try {
            // Clear cache to allow hot-reloading if needed
            delete require.cache[require.resolve(filePath)];
            const cmd = require(filePath);

            if (cmd && cmd.name) {
                // If category is not set, use the folder name as category
                if (!cmd.category) {
                    const relativePath = path.relative(commandsPath, filePath);
                    const parts = relativePath.split(path.sep);
                    cmd.category = parts.length > 1 ? parts[0] : 'general';
                }

                commands.set(cmd.name.toLowerCase(), cmd);
                count++;

                if (cmd.aliases && Array.isArray(cmd.aliases)) {
                    cmd.aliases.forEach(alias => {
                        commands.set(alias.toLowerCase(), cmd);
                    });
                }
            } else {
                // Not a valid command file (doesn't export name)
            }
        } catch (err) {
            const fileName = path.basename(filePath);
            console.error(`\x1b[31m[SYSTEM] Failed to load command ${fileName}: ${err.message}\x1b[0m`);
            skipped.push({ file: fileName, error: err.message });
        }
    });

    console.log(`\x1b[32m[SYSTEM] Successfully loaded ${count} commands.\x1b[0m`);
    if (skipped.length > 0) {
        console.warn(`\x1b[33m[SYSTEM] Skipped ${skipped.length} broken commands.\x1b[0m`);
    }

    return commands;
};

module.exports = { loadCommands };
