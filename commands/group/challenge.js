/**
 * @file challenge.js
 * @description Daily Group Challenges & Tasks System.
 * 
 * Features:
 * - Daily challenges with rewards
 * - Weekly challenges
 * - Group tasks
 * - Achievement system
 * - Challenge streaks
 */

const fs = require('fs');
const path = require('path');

const CHALLENGE_DATA_FILE = path.join(__dirname, '../../data/challengeData.json');

const DAILY_CHALLENGES = [
    { id: 'msg10', title: 'Send 10 messages today', description: 'Be active in the group!', target: 10, type: 'messages', reward: 50 },
    { id: 'react5', title: 'React to 5 messages', description: 'Show some love!', target: 5, type: 'reactions', reward: 30 },
    { id: 'sticker3', title: 'Send 3 stickers', description: 'Express yourself!', target: 3, type: 'stickers', reward: 25 },
    { id: 'share1', title: 'Share something useful', description: 'Share a link or article', target: 1, type: 'links', reward: 40 },
    { id: 'help1', title: 'Help someone today', description: 'Answer a question in the group', target: 1, type: 'help', reward: 60 },
    { id: 'quiz3', title: 'Win 3 trivia questions', description: 'Show your knowledge!', target: 3, type: 'trivia', reward: 45 },
    { id: 'poll1', title: 'Vote in a poll', description: 'Make your voice heard!', target: 1, type: 'polls', reward: 20 },
    { id: 'goodmorning', title: 'Send a good morning message', description: 'Start the day right!', target: 1, type: 'greeting', reward: 15 },
    { id: 'joke1', title: 'Tell a joke', description: 'Make someone smile!', target: 1, type: 'jokes', reward: 35 },
    { id: 'thanks3', title: 'Say thank you 3 times', description: 'Spread gratitude!', target: 3, type: 'thanks', reward: 25 }
];

const WEEKLY_CHALLENGES = [
    { id: 'active7', title: 'Be active 7 days in a row', description: 'Daily login streak!', target: 7, type: 'streak', reward: 200 },
    { id: 'msg100', title: 'Send 100 messages this week', description: 'Be a conversation starter!', target: 100, type: 'messages', reward: 150 },
    { id: 'help10', title: 'Help 10 people', description: 'Be the helper!', target: 10, type: 'help', reward: 300 },
    { id: 'trivia10', title: 'Win 10 trivia questions', description: 'Trivia master!', target: 10, type: 'trivia', reward: 250 },
    { id: 'share5', title: 'Share 5 useful links', description: 'Knowledge sharer!', target: 5, type: 'links', reward: 175 },
    { id: 'friend3', title: 'Welcome 3 new members', description: 'Be welcoming!', target: 3, type: 'welcomes', reward: 200 }
];

class ChallengeSystem {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        try {
            const dir = path.dirname(CHALLENGE_DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(CHALLENGE_DATA_FILE)) {
                const defaults = { groups: {}, achievements: {} };
                fs.writeFileSync(CHALLENGE_DATA_FILE, JSON.stringify(defaults, null, 2));
                return defaults;
            }
            return JSON.parse(fs.readFileSync(CHALLENGE_DATA_FILE, 'utf8'));
        } catch (e) {
            return { groups: {}, achievements: {} };
        }
    }

    save() {
        try {
            fs.writeFileSync(CHALLENGE_DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[Challenge] Save error:', e);
        }
    }

    getGroupData(groupId) {
        if (!this.data.groups[groupId]) {
            this.data.groups[groupId] = {
                daily: {},
                weekly: {},
                participants: {},
                completedChallenges: [],
                lastDailyReset: null,
                lastWeeklyReset: null
            };
        }
        return this.data.groups[groupId];
    }

    getDailyChallenges(groupId) {
        const groupData = this.getGroupData(groupId);
        const today = new Date().toISOString().split('T')[0];

        // Reset daily challenges if new day
        if (groupData.lastDailyReset !== today) {
            // Select 3 random daily challenges
            const shuffled = [...DAILY_CHALLENGES].sort(() => Math.random() - 0.5);
            groupData.daily = {};
            shuffled.slice(0, 3).forEach(challenge => {
                groupData.daily[challenge.id] = {
                    ...challenge,
                    progress: {},
                    completedBy: []
                };
            });
            groupData.lastDailyReset = today;
            this.save();
        }

        return groupData.daily;
    }

    getWeeklyChallenges(groupId) {
        const groupData = this.getGroupData(groupId);
        const today = new Date();
        const weekStart = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];

        // Reset weekly challenges if new week
        if (groupData.lastWeeklyReset !== weekStart) {
            // Select 2 random weekly challenges
            const shuffled = [...WEEKLY_CHALLENGES].sort(() => Math.random() - 0.5);
            groupData.weekly = {};
            shuffled.slice(0, 2).forEach(challenge => {
                groupData.weekly[challenge.id] = {
                    ...challenge,
                    progress: {},
                    completedBy: []
                };
            });
            groupData.lastWeeklyReset = weekStart;
            this.save();
        }

        return groupData.weekly;
    }

    updateProgress(groupId, userId, type, amount = 1) {
        const groupData = this.getGroupData(groupId);
        const challenges = { ...this.getDailyChallenges(groupId), ...this.getWeeklyChallenges(groupId) };
        const completed = [];

        Object.entries(challenges).forEach(([id, challenge]) => {
            if (challenge.completedBy.includes(userId)) return;
            if (challenge.type !== type) return;

            if (!challenge.progress[userId]) challenge.progress[userId] = 0;
            challenge.progress[userId] += amount;

            if (challenge.progress[userId] >= challenge.target) {
                challenge.completedBy.push(userId);
                completed.push({ id, title: challenge.title, reward: challenge.reward });

                // Award points
                if (!groupData.participants[userId]) {
                    groupData.participants[userId] = { points: 0, challengesCompleted: 0, streak: 0 };
                }
                groupData.participants[userId].points += challenge.reward;
                groupData.participants[userId].challengesCompleted++;
            }
        });

        this.save();
        return completed;
    }

    getProgress(groupId, userId) {
        const groupData = this.getGroupData(groupId);
        const daily = this.getDailyChallenges(groupId);
        const weekly = this.getWeeklyChallenges(groupId);

        let text = `📋 *Your Challenge Progress*\n\n`;

        text += `*Daily Challenges:*\n`;
        Object.values(daily).forEach(challenge => {
            const progress = challenge.progress[userId] || 0;
            const completed = challenge.completedBy.includes(userId);
            const emoji = completed ? '✅' : '⏳';
            const bar = this.progressBar(progress, challenge.target);
            text += `${emoji} ${challenge.title}\n   ${bar} ${progress}/${challenge.target} (+${challenge.reward}pts)\n`;
        });

        text += `\n*Weekly Challenges:*\n`;
        Object.values(weekly).forEach(challenge => {
            const progress = challenge.progress[userId] || 0;
            const completed = challenge.completedBy.includes(userId);
            const emoji = completed ? '✅' : '⏳';
            const bar = this.progressBar(progress, challenge.target);
            text += `${emoji} ${challenge.title}\n   ${bar} ${progress}/${challenge.target} (+${challenge.reward}pts)\n`;
        });

        const participant = groupData.participants[userId] || { points: 0, challengesCompleted: 0 };
        text += `\n📊 *Your Stats:*\n`;
        text += `• Points: ${participant.points}\n`;
        text += `• Completed: ${participant.challengesCompleted}\n`;

        return text;
    }

    getLeaderboard(groupId, limit = 10) {
        const groupData = this.getGroupData(groupId);
        
        return Object.entries(groupData.participants)
            .map(([userId, data]) => ({ userId, ...data }))
            .sort((a, b) => b.points - a.points)
            .slice(0, limit);
    }

    progressBar(current, total) {
        const filled = Math.min(Math.round((current / total) * 8), 8);
        const empty = 8 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

module.exports = {
    name: 'challenge',
    aliases: ['challenges', 'daily', 'weekly'],
    category: 'group',
    description: 'Daily and weekly group challenges',
    usage: '.challenge <daily/weekly/progress/leaderboard>',
    isGroup: true,

    async execute(sock, msg, args, extra) {
        try {
            const challengeSystem = new ChallengeSystem();
            const groupId = extra.from;
            const action = args[0]?.toLowerCase() || 'daily';

            switch (action) {
                case 'daily': {
                    const challenges = challengeSystem.getDailyChallenges(groupId);
                    let text = `🎯 *Daily Challenges*\n\n`;
                    
                    Object.values(challenges).forEach(challenge => {
                        text += `📌 *${challenge.title}*\n`;
                        text += `   ${challenge.description}\n`;
                        text += `   Reward: +${challenge.reward} points\n\n`;
                    });
                    
                    text += `> _Complete challenges to earn points!_`;
                    return extra.reply(text);
                }

                case 'weekly': {
                    const challenges = challengeSystem.getWeeklyChallenges(groupId);
                    let text = `📅 *Weekly Challenges*\n\n`;
                    
                    Object.values(challenges).forEach(challenge => {
                        text += `🏆 *${challenge.title}*\n`;
                        text += `   ${challenge.description}\n`;
                        text += `   Reward: +${challenge.reward} points\n\n`;
                    });
                    
                    text += `> _Big rewards for weekly challenges!_`;
                    return extra.reply(text);
                }

                case 'progress':
                case 'me':
                    return extra.reply(challengeSystem.getProgress(groupId, extra.sender));

                case 'leaderboard':
                case 'lb':
                case 'top': {
                    const leaderboard = challengeSystem.getLeaderboard(groupId);
                    if (leaderboard.length === 0) {
                        return extra.reply('📊 No challenges completed yet in this group!');
                    }

                    let text = `🏆 *Challenge Leaderboard*\n\n`;
                    leaderboard.forEach((entry, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        text += `${medal} @${entry.userId.split('@')[0]} - ${entry.points}pts (${entry.challengesCompleted} completed)\n`;
                    });
                    return extra.reply(text);
                }

                default:
                    return extra.reply(
                        `🎯 *Challenge System*\n\n` +
                        `*Commands:*\n` +
                        `• \`.challenge daily\` - View daily challenges\n` +
                        `• \`.challenge weekly\` - View weekly challenges\n` +
                        `• \`.challenge progress\` - Your progress\n` +
                        `• \`.challenge leaderboard\` - Top players\n\n` +
                        `> _Complete challenges to earn points and climb the leaderboard!_`
                    );
            }
        } catch (error) {
            console.error('[CHALLENGE ERROR]', error);
            await extra.reply('❌ Error with challenge system.');
        }
    }
};
