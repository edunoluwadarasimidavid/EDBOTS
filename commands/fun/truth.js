const TRUTH_QUESTIONS = [
    "What is your biggest fear?",
    "What is your most embarrassing moment?",
    "Have you ever lied to your best friend?",
    "Who is your secret crush?",
    "What is the worst gift you have ever received?",
    "If you could change one thing about yourself, what would it be?",
    "Have you ever cheated on a test?",
    "What is your guilty pleasure?",
    "Who was your first love?",
    "What is the most trouble you've ever been in?",
    "Have you ever ghosted someone?",
    "What is a secret you’ve never told anyone?",
    "If you could date anyone in this group, who would it be?",
    "What is the most expensive thing you've bought?",
    "Have you ever stalked someone on social media?"
];

module.exports = {
    name: 'truth',
    aliases: [],
    category: 'fun',
    desc: 'Get a random truth question',
    usage: 'truth',
    execute: async (sock, msg, args, extra) => {
        const question = TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
        await extra.reply(`🗣️ *TRUTH*\n\n${question}`);
    }
};
