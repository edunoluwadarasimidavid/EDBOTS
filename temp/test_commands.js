const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, '../commands');
const report = {
    total: 0,
    success: 0,
    failed: 0,
    errors: []
};

// Recursive file finder
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

try {
    const files = getAllFiles(commandsDir);
    report.total = files.length;

    files.forEach(file => {
        try {
            // clear cache to ensure fresh load
            delete require.cache[require.resolve(file)];
            const cmd = require(file);

            if (!cmd.name) {
                throw new Error('Missing "name" property');
            }
            if (!cmd.execute || typeof cmd.execute !== 'function') {
                throw new Error('Missing "execute" function');
            }
            report.success++;
        } catch (error) {
            report.failed++;
            report.errors.push({
                file: path.relative(commandsDir, file),
                message: error.message
            });
        }
    });

    console.log(JSON.stringify(report, null, 2));

} catch (e) {
    console.error('Critical error running test:', e);
}
