/**
 * Rock Paper Scissors Command
 * Play RPS against the bot
 */

module.exports = {
    name: 'rps',
    aliases: ['rockpaperscissors', 'rpsgame'],
    category: 'fun',
    description: 'Play Rock Paper Scissors against the bot',
    usage: '.rps <rock/paper/scissors>',
    
    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `✊ *Rock Paper Scissors*\n\n` +
                    `Usage: .rps <choice>\n\n` +
                    `*Choices:*\n` +
                    `• \`rock\` ✊\n` +
                    `• \`paper\` ✋\n` +
                    `• \`scissors\` ✌️\n\n` +
                    `Example: .rps rock`
                );
            }

            const choices = ['rock', 'paper', 'scissors'];
            const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
            const winMap = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

            const playerChoice = args[0].toLowerCase();
            if (!choices.includes(playerChoice)) {
                return extra.reply('❌ Invalid choice! Use `rock`, `paper`, or `scissors`.');
            }

            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            const playerEmoji = emojis[playerChoice];
            const botEmoji = emojis[botChoice];

            let result;
            if (playerChoice === botChoice) {
                result = '🤝 It\'s a *draw*!';
            } else if (winMap[playerChoice] === botChoice) {
                result = '🎉 You *win*!';
            } else {
                result = '🤖 Bot *wins*!';
            }

            const text = `✊ *Rock Paper Scissors*\n\n` +
                `You: ${playerEmoji} *${playerChoice}*\n` +
                `Bot: ${botEmoji} *${botChoice}*\n\n` +
                `${result}`;

            await extra.reply(text);

        } catch (error) {
            console.error('[RPS ERROR]', error);
            await extra.reply('❌ Error playing RPS.');
        }
    }
};
