/**
 * @file prompts.js
 * @description Interactive CLI prompt utilities for EDBots.
 */

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Ask a question and return the answer
 */
function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

/**
 * Ask with a default value (ENTER keeps current)
 */
function askWithDefault(question, currentValue) {
    return new Promise((resolve) => {
        const display = currentValue ? `[${currentValue}]` : '[empty]';
        rl.question(`${question} ${display}: `, (answer) => {
            const trimmed = answer.trim();
            resolve(trimmed === '' ? currentValue : trimmed);
        });
    });
}

/**
 * Ask yes/no question
 */
function askYesNo(question, defaultYes = true) {
    return new Promise((resolve) => {
        const hint = defaultYes ? 'Y/n' : 'y/N';
        rl.question(`${question} (${hint}): `, (answer) => {
            const trimmed = answer.trim().toLowerCase();
            if (trimmed === '') return resolve(defaultYes);
            resolve(trimmed === 'y' || trimmed === 'yes');
        });
    });
}

/**
 * Ask for a selection from a list
 */
function askChoice(question, choices) {
    return new Promise((resolve) => {
        console.log(`\n${question}`);
        choices.forEach((choice, i) => {
            console.log(`  [${i + 1}] ${choice.label || choice}`);
        });
        rl.question('\nSelect an option: ', (answer) => {
            const index = parseInt(answer) - 1;
            if (index >= 0 && index < choices.length) {
                resolve(choices[index]);
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Close the readline interface
 */
function close() {
    rl.close();
}

module.exports = { ask, askWithDefault, askYesNo, askChoice, close };
