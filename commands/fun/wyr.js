/**
 * Would You Rather Command
 * Fun "this or that" game for groups and DMs
 */

const APIs = require('../../utils/api');

module.exports = {
    name: 'wyr',
    aliases: ['wouldyourather', 'wyrp'],
    category: 'fun',
    description: 'Would You Rather game',
    usage: '.wyr',
    
    async execute(sock, msg, args, extra) {
        try {
            const [optionA, optionB] = APIs.getWYR();

            const text = `🤔 *Would You Rather*\n\n` +
                `🅰️ *${optionA}*\n\n` +
                `🅱️ *${optionB}*\n\n` +
                `React with 🅰️ or 🅱️ to vote!\n\n` +
                `_Reply with \`.wyr\` for a new question_`;

            await extra.reply(text);

        } catch (error) {
            console.error('[WYR ERROR]', error);
            await extra.reply('❌ Error getting question.');
        }
    }
};
