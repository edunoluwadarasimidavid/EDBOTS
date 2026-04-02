const axios = require('axios');
const config = require('../../config');
const { BACKEND_BASE_URL } = require('../../config/backendUrl');

module.exports = {
  name: 'buy',
  aliases: ['purchase'],
  description: 'Purchase EDBOT premium plans.',
  category: 'premium',
  usage: '.buy <weekly|monthly|yearly>',
  execute: async (sock, msg, args, context) => {
    const { from, sender, reply } = context;
    const userId = sender.split('@')[0];

    if (args.length === 0) {
      return await reply(`❌ Please specify a plan: \`weekly\`, \`monthly\`, or \`yearly\`.
Example: \`.buy monthly\``);
    }

    const plan = args[0].toLowerCase();
    const validPlans = ['weekly', 'monthly', 'yearly'];

    if (!validPlans.includes(plan)) {
      return await reply(`❌ Invalid plan. Choose from: ${validPlans.join(', ')}`);
    }

    try {
      await reply('⏳ Generating payment link...');

      // Note: Backend is mounted as app.use('/payment', paymentRoutes) 
      // where /create is defined in paymentRoutes.js
      // So the full path is /payment/create
      const response = await axios.post(`${BACKEND_BASE_URL}/payment/create`, {
        userId,
        plan
      });

      if (response.data.success) {
        const message = `🌟 *EDBOT PREMIUM UPGRADE*

` +
          `Plan: ${plan.toUpperCase()}
` +
          `User: @${userId}

` +
          `💳 *Click the link below to pay:*
` +
          `${response.data.link}

` +
          `_After payment, premium will be activated automatically._`;

        return await reply(message);
      } else {
        return await reply('❌ Failed to generate payment link. ' + (response.data.message || ''));
      }
    } catch (error) {
      console.error('Buy Command Error:', error.message);
      const errorMsg = error.response ? `Backend error: ${error.response.status}` : 'Backend connection error.';
      return await reply(`❌ ${errorMsg} Please try again later.`);
    }
  }
};
