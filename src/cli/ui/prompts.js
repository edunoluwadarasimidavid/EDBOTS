/**
 * @file prompts.js
 * @description Interactive CLI prompt utilities for EDBots.
 *
 * Design notes:
 * - A single persistent readline interface is created lazily and reused
 *   for every question. This fixes the classic bug where calling ask()
 *   after close() hangs forever (it broke the pairing-code flow).
 * - Lines are routed through an internal queue, so input that arrives
 *   early (piped stdin, fast typists) is never lost between questions.
 * - If stdin ends (EOF, piped-closed input, < /dev/null) while a
 *   question is pending, the promise resolves with `null` instead of
 *   hanging the CLI. After EOF, any further ask() resolves null
 *   immediately — the CLI can never deadlock on a dead stream.
 */

const readline = require('readline');

let iface = null;
let streamClosed = false;
const lineQueue = [];
const waiters = [];

/**
 * Get (or lazily create) the shared readline interface.
 */
function getInterface() {
    if (iface) return iface;

    iface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: process.stdin.isTTY === true,
    });

    iface.on('line', (line) => {
        const waiter = waiters.shift();
        if (waiter) waiter(line);
        else lineQueue.push(line); // arrive-early input: queue, never lose
    });

    iface.on('close', () => {
        streamClosed = true;
        iface = null;
        // Unblock every pending question with null
        while (waiters.length) {
            const waiter = waiters.shift();
            waiter(null);
        }
    });

    return iface;
}

/**
 * Ask a question and return the trimmed answer.
 * Resolves with `null` if stdin ends before an answer arrives.
 */
async function ask(question) {
    if (streamClosed) return null;

    if (lineQueue.length > 0) {
        process.stdout.write(question);
        return (lineQueue.shift() || '').trim();
    }

    getInterface(); // ensure listener is attached before writing the prompt
    process.stdout.write(question);
    return new Promise((resolve) => {
        const waiter = (line) => resolve(line === null ? null : (line || '').trim());
        waiters.push(waiter);
    });
}

/**
 * Ask with a default value (ENTER keeps current).
 * EOF resolves with the current value.
 */
async function askWithDefault(question, currentValue) {
    const answer = await ask(`${question} [${currentValue !== undefined && currentValue !== null ? currentValue : 'empty'}]: `);
    if (answer === null) return currentValue;
    return answer === '' ? currentValue : answer;
}

/**
 * Ask yes/no question.
 * EOF resolves with the default.
 */
async function askYesNo(question, defaultYes = true) {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const answer = await ask(`${question} (${hint}): `);
    if (answer === null || answer === '') return defaultYes;
    const trimmed = answer.trim().toLowerCase();
    return trimmed === 'y' || trimmed === 'yes';
}

/**
 * Ask for a selection from a list. Returns the chosen item or null.
 */
async function askChoice(question, choices) {
    console.log(`\n${question}`);
    choices.forEach((choice, i) => {
        console.log(`  [${i + 1}] ${choice.label || choice}`);
    });
    const answer = await ask('\nSelect an option: ');
    if (answer === null) return null;
    const index = parseInt(answer, 10) - 1;
    return index >= 0 && index < choices.length ? choices[index] : null;
}

/**
 * Close the readline interface.
 * Safe to call multiple times — pending questions are unblocked and
 * future ask() calls will resolve with null (stream is treated as ended
 * on non-TTY) or keep working (on TTY the interface is recreated).
 */
function close() {
    if (iface) {
        try { iface.close(); } catch (e) { /* already closed */ }
        iface = null;
    }
    if (process.stdin.isTTY !== true) {
        streamClosed = true; // piped input: once done, it's done
    }
}

// Reset closed-state when a new TTY session starts (defensive: if a
// previous close() happened in the same process on a TTY, allow reuse).
if (process.stdin.isTTY === true) {
    streamClosed = false;
}

module.exports = { ask, askWithDefault, askYesNo, askChoice, close };
