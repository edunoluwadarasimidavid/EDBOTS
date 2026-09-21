/**
 * @file quiz.js — Interactive group quiz with timed answering.
 * Powered by OpenTDB (free, no key). First correct answer wins!
 *
 * Flow:
 *   .quiz            → random question, 4 options, 60s window
 *   .quiz answer A   → submit your answer
 *   .quiz scores     → group leaderboard (persisted)
 */

const fs = require('fs');
const path = require('path');
const { getTriviaQuestion } = require('../../utils/groupGames');

const SCORES_FILE = path.join(__dirname, '../../data/quiz_scores.json');

function loadScores() {
    try {
        if (!fs.existsSync(SCORES_FILE)) return {};
        return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveScores(data) {
    try {
        const dir = path.dirname(SCORES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

// Active quizzes per group (in-memory)
const activeQuizzes = new Map(); // groupId -> { question, correct, options, answerLetter, endsAt, timeout }

function getScoresFor(groupId) {
    const scores = loadScores();
    if (!scores[groupId]) scores[groupId] = {};
    return scores[groupId];
}

module.exports = {
    name: 'quiz',
    aliases: ['trivia2'],
    category: 'group',
    description: 'Interactive quiz: first correct answer wins a point',
    usage: '.quiz | .quiz answer <letter> | .quiz scores',
    groupOnly: true,
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        const groupId = extra.from;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderName = msg.pushName || 'Player';

        try {
            const sub = (args[0] || '').toLowerCase();

            // ── Scores ──
            if (sub === 'scores' || sub === 'leaderboard') {
                const scores = getScoresFor(groupId);
                const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 10);

                if (ranked.length === 0) {
                    return extra.reply('📊 No scores yet! Start a quiz with `.quiz`');
                }

                let text = `🏆 *Quiz Leaderboard*\n\n`;
                const medals = ['🥇', '🥈', '🥉'];
                ranked.forEach(([user, pts], i) => {
                    const medal = medals[i] || `${i + 1}.`;
                    text += `${medal} ${user} — ${pts} pt${pts !== 1 ? 's' : ''}\n`;
                });
                return extra.reply(text);
            }

            // ── Answer submission ──
            if (sub === 'answer' || ['a', 'b', 'c', 'd'].includes(sub)) {
                const letter = sub === 'answer' ? (args[1] || '').toUpperCase() : sub.toUpperCase();
                const quiz = activeQuizzes.get(groupId);

                if (!quiz) {
                    return extra.reply('❌ No active quiz. Start one with `.quiz`');
                }
                if (Date.now() > quiz.endsAt) {
                    return extra.reply('⏰ This quiz has already ended!');
                }
                if (quiz.answered.has(sender)) {
                    return extra.reply('✋ You already answered!');
                }

                quiz.answered.set(sender, { letter, name: senderName });

                if (letter === quiz.answerLetter) {
                    // Correct! Award point, end quiz
                    const scores = getScoresFor(groupId);
                    scores[senderName] = (scores[senderName] || 0) + 1;
                    saveScores(loadScores()); // ensure file structure ok
                    const all = loadScores();
                    all[groupId] = scores;
                    saveScores(all);

                    clearTimeout(quiz.timeout);
                    activeQuizzes.delete(groupId);

                    return extra.reply(
                        `🎉 *Correct, ${senderName}!*\n\n` +
                        `The answer was *${quiz.answerLetter}. ${quiz.correct}*\n\n` +
                        `🏆 +1 point! View scores: \`.quiz scores\``
                    );
                }

                return extra.reply(`❌ Not quite, ${senderName}! Try again…`);
            }

            // ── Start new quiz ──
            if (activeQuizzes.has(groupId)) {
                const q = activeQuizzes.get(groupId);
                const remaining = Math.max(0, Math.ceil((q.endsAt - Date.now()) / 1000));
                return extra.reply(
                    `⏳ A quiz is already running (${remaining}s left):\n\n${q.question}\n\n` +
                    q.options.join('\n') +
                    `\n\nAnswer: \`.quiz A\` (etc.)`
                );
            }

            const q = await getTriviaQuestion();
            if (!q) return extra.reply('❌ Could not fetch a quiz question. Try again.');

            const endsAt = Date.now() + 60000;

            const quiz = {
                question: q.question,
                correct: q.correct,
                options: q.options,
                answerLetter: q.answerLetter,
                endsAt,
                answered: new Map(),
                timeout: null
            };

            // Auto-expire after 60s
            quiz.timeout = setTimeout(() => {
                if (activeQuizzes.get(groupId) === quiz) {
                    activeQuizzes.delete(groupId);
                    sock.sendMessage(groupId, {
                        text:
                            `⏰ *Time's up!*\n\n` +
                            `Nobody got it — the answer was *${quiz.answerLetter}. ${quiz.correct}*\n\n` +
                            `Start another: \`.quiz\``
                    }).catch(() => {});
                }
            }, 60000);

            activeQuizzes.set(groupId, quiz);

            const catInfo = q.category ? `_${q.category} · ${q.difficulty}_` : '';
            await extra.reply(
                `🧠 *QUIZ TIME!*\n${catInfo}\n\n` +
                `*${q.question}*\n\n` +
                q.options.join('\n') +
                `\n\n⏱️ You have *60 seconds*!\n` +
                `Answer: \`.quiz A\` (etc.) — first correct wins 🏆`
            );
        } catch (err) {
            console.error('[QUIZ ERROR]', err.message);
            await extra.reply('❌ Quiz error. Try again.');
        }
    }
};
