/**
 * Poll Command - Create interactive polls in groups
 * Usage: .poll Question | Option1 | Option2
 *        .poll-vote <pollId> <option>
 *        .poll-end <pollId>
 */

const fs = require('fs');
const path = require('path');

const POLLS_FILE = path.join(__dirname, '../../data/polls.json');

function loadPolls() {
    try {
        if (!fs.existsSync(POLLS_FILE)) {
            fs.writeFileSync(POLLS_FILE, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(POLLS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function savePolls(polls) {
    try {
        const dir = path.dirname(POLLS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(POLLS_FILE, JSON.stringify(polls, null, 2));
    } catch (e) {
        console.error('[POLL] Save error:', e);
    }
}

// Reusable handler for poll vote and poll end
async function handlePollSubCommand(sock, msg, args, extra, subCommand) {
    try {
        const polls = loadPolls();
        const chatPolls = Object.values(polls).filter(
            p => p.chatId === extra.from && p.active
        );

        if (chatPolls.length === 0) {
            return extra.reply('📊 No active polls in this chat.');
        }

        if (subCommand === 'vote') {
            const pollId = args[0];
            const optionIdx = parseInt(args[1]) - 1;
            const poll = polls[pollId];

            if (!poll || !poll.active) return extra.reply('❌ Poll not found or ended.');
            if (isNaN(optionIdx) || optionIdx < 0 || optionIdx >= poll.options.length) {
                return extra.reply(`❌ Invalid option. Choose 1-${poll.options.length}`);
            }

            // Remove previous vote if exists
            poll.options.forEach(opt => {
                opt.voters = opt.voters.filter(v => v !== extra.sender);
            });

            poll.options[optionIdx].voters.push(extra.sender);

            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voters.length, 0);

            let text = `📊 *${poll.question}*\n\n`;
            poll.options.forEach((opt, i) => {
                const votes = opt.voters.length;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
                text += `${i + 1}. ${opt.text}\n   ${bar} ${pct}% (${votes})\n`;
            });
            text += `\n🗳️ Total votes: ${totalVotes} | ID: ${pollId}`;

            savePolls(polls);
            return extra.reply(text);

        } else if (subCommand === 'end') {
            const pollId = args[0];
            const poll = polls[pollId];

            if (!poll || !poll.active) return extra.reply('❌ Poll not found or already ended.');

            // Only creator or owner can end
            if (poll.creator !== extra.sender && !extra.isOwner) {
                return extra.reply('❌ Only the poll creator or bot owner can end a poll.');
            }

            poll.active = false;
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voters.length, 0);

            let text = `📊 *Poll Results: ${poll.question}*\n\n`;
            poll.options.forEach((opt, i) => {
                const votes = opt.voters.length;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                text += `${medal} ${opt.text}: *${votes} votes* (${pct}%)\n`;
            });
            text += `\n✅ Total votes: ${totalVotes}\n🏆 Poll ended by @${extra.sender.split('@')[0]}`;

            savePolls(polls);
            return sock.sendMessage(extra.from, { text, mentions: [extra.sender] }, { quoted: msg });
        }
    } catch (error) {
        console.error('[POLL ERROR]', error);
        return extra.reply('❌ Error processing poll command.');
    }
}

module.exports = {
    name: 'poll',
    aliases: ['vote'],
    category: 'utility',
    description: 'Create and vote on polls',
    usage: '.poll Question | Option1 | Option2 (max 8 options)',
    groupOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            // Sub-commands
            const first = (args[0] || '').toLowerCase();
            if (first === 'vote' || first === 'v') {
                return handlePollSubCommand(sock, msg, args.slice(1), extra, 'vote');
            }
            if (first === 'end' || first === 'close') {
                return handlePollSubCommand(sock, msg, args.slice(1), extra, 'end');
            }
            if (first === 'list' || first === 'ls') {
                const polls = loadPolls();
                const active = Object.values(polls).filter(p => p.chatId === extra.from && p.active);
                if (active.length === 0) return extra.reply('📊 No active polls.');
                let text = '📊 *Active Polls:*\n\n';
                active.forEach((p, i) => {
                    const total = p.options.reduce((s, o) => s + o.voters.length, 0);
                    text += `${i + 1}. *${p.question}* (${total} votes) - ID: ${p.id}\n`;
                });
                return extra.reply(text);
            }

            // Create new poll
            const raw = args.join(' ');
            const parts = raw.split('|').map(s => s.trim()).filter(Boolean);

            if (parts.length < 3) {
                return extra.reply(
                    `📊 *Create a Poll*\n\n` +
                    `Usage: .poll Question | Option1 | Option2\n\n` +
                    `*Examples:*\n` +
                    `• \`.poll Best OS? | Windows | Mac | Linux\`\n` +
                    `• \`.poll Food for lunch? | Pizza | Burger | Sushi | Rice\`\n\n` +
                    `*Sub-commands:*\n` +
                    `• \`.poll vote <id> <option>\` - Vote\n` +
                    `• \`.poll end <id>\` - End poll\n` +
                    `• \`.poll list\` - View active polls`
                );
            }

            if (parts.length > 9) {
                return extra.reply('❌ Maximum 8 options allowed.');
            }

            const question = parts[0];
            const options = parts.slice(1).map(text => ({ text, voters: [] }));
            const pollId = Date.now().toString(36).slice(-6);

            const polls = loadPolls();
            polls[pollId] = {
                id: pollId,
                chatId: extra.from,
                creator: extra.sender,
                question,
                options,
                active: true,
                createdAt: Date.now()
            };
            savePolls(polls);

            let text = `📊 *${question}*\n\n`;
            options.forEach((opt, i) => {
                text += `${i + 1}. ${opt.text}\n`;
            });
            text += `\n🗳️ Vote: \`.poll vote ${pollId} <1-${options.length}>\``;
            text += `\n🆔 Poll ID: ${pollId}`;

            await extra.reply(text);

        } catch (error) {
            console.error('[POLL ERROR]', error);
            await extra.reply('❌ Error creating poll.');
        }
    }
};
