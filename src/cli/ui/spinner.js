/**
 * @file spinner.js
 * @description CLI spinner for loading indicators.
 */

const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

class Spinner {
    constructor(text = '') {
        this.text = text;
        this.frames = SPINNERS;
        this.index = 0;
        this.interval = null;
        this.running = false;
    }

    start(text) {
        if (text) this.text = text;
        this.running = true;
        this.index = 0;
        
        this.interval = setInterval(() => {
            process.stdout.write(`\r\x1b[36m${this.frames[this.index]}\x1b[0m ${this.text}`);
            this.index = (this.index + 1) % this.frames.length;
        }, 80);
        
        return this;
    }

    stop(finalText) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
        
        if (finalText) {
            process.stdout.write(`\r\x1b[32m✓\x1b[0m ${finalText}\n`);
        } else {
            process.stdout.write('\r' + ' '.repeat(this.text.length + 5) + '\r');
        }
        return this;
    }

    fail(finalText) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
        
        if (finalText) {
            process.stdout.write(`\r\x1b[31m✗\x1b[0m ${finalText}\n`);
        }
        return this;
    }

    update(text) {
        this.text = text;
        return this;
    }
}

function spinner(text) {
    return new Spinner(text);
}

module.exports = { spinner, Spinner };
