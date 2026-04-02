const axios = require('axios');
const config = require('../../config');
const { isOwner } = require('../../core/permissions');
const { BACKEND_BASE_URL } = require('../../config/backendUrl');
const moment = require('moment-timezone');

module.exports = {
  name: 'premium',
  aliases: ['prem'],
  description: 'Purchase premium to unlock anti-ban limits, premium commands, and group features for this bot instance.',
  category: 'premium',
  usage: '.premium',
  execute: async (sock, msg, args, context) => {
    const { from, sender, reply, isOwner: ownerStatus } = context;
    const userId = sender.split('@')[0];

    try {
      if (ownerStatus) {
        // OWNER DASHBOARD
        const [analyticsRes, usersRes] = await Promise.all([
          axios.get(`${BACKEND_BASE_URL}/api/premium/analytics`).catch(() => ({ data: { success: false } })),
          axios.get(`${BACKEND_BASE_URL}/api/premium/list`).catch(() => ({ data: { success: false } }))
        ]);

        let dashboard = `👑 *EDBOT PREMIUM DASHBOARD*\n\n`;
        
        if (analyticsRes.data.success) {
          const data = analyticsRes.data.data;
          dashboard += `📊 *Analytics*\n`;
          dashboard += `Total Users: ${data.total_premium_users}\n`;
          dashboard += `Active Premium: ${data.active_premium_users}\n`;
          dashboard += `Total Revenue: ₦${data.total_revenue.toLocaleString()}\n\n`;
        }

        if (usersRes.data.success) {
          dashboard += `👥 *Premium Users*\n`;
          const users = usersRes.data.users;
          if (users.length === 0) {
            dashboard += `No premium users yet.\n`;
          } else {
            users.slice(0, 10).forEach((u, i) => {
              const expiry = moment(u.expires_at).format('YYYY-MM-DD');
              dashboard += `${i+1}. @${u.user_id} (${u.plan}) - Exp: ${expiry}\n`;
            });
            if (users.length > 10) dashboard += `...and ${users.length - 10} more.\n`;
          }
        } else {
          dashboard += `❌ Failed to fetch analytics from backend.\n`;
        }

        dashboard += `\n_The system automatically manages expiry._`;
        return await reply(dashboard);
      } else {
        // PUBLIC VIEW (UPGRADED UX)
        const statusRes = await axios.get(`${BACKEND_BASE_URL}/api/premium/status?userId=${userId}`).catch(() => ({ data: { isPremium: false, plan: 'free' } }));
        const data = statusRes.data;

        let message = `🌟 *EDBOT PREMIUM SYSTEM*\n\n`;

        if (data.isPremium) {
          const expiry = moment(data.expiresAt).format('LLLL');
          message += `✅ *STATUS: PREMIUM ACTIVE*\n`;
          message += `💎 *Plan:* ${data.plan.toUpperCase()}\n`;
          message += `⏳ *Used:* ${data.used} / ${data.limit} AI requests\n`;
          message += `🗓️ *Expires:* ${expiry}\n\n`;
          message += `🚀 *Unlocked Benefits:*\n`;
          message += `- Peak Anti-Ban protection (80 msgs/min)\n`;
          message += `- Priority AI processing\n`;
          message += `- All Premium commands enabled\n`;
          message += `- Unlimited bandwidth & zero cooldowns\n`;
        } else {
          message += `❌ *STATUS: FREE USER*\n`;
          message += `📊 *Usage:* ${data.used || 0} / 5 daily requests\n\n`;
          message += `Upgrade to Premium to unlock full potential and higher anti-ban limits!\n\n`;
          
          message += `💳 *CHOOSE YOUR PLAN:*\n\n`;
          
          message += `1️⃣ *WEEKLY* - ₦500\n`;
          message += `- 7 Days access\n`;
          message += `- 20 AI requests\n`;
          message += `- Premium commands enabled\n`;
          message += `- Limited bandwidth\n\n`;

          message += `2️⃣ *MONTHLY* - ₦1,500\n`;
          message += `- 30 Days access\n`;
          message += `- 60 AI requests\n`;
          message += `- All premium commands\n`;
          message += `- Higher bandwidth\n\n`;

          message += `3️⃣ *YEARLY* - ₦15,000\n`;
          message += `- 365 Days access\n`;
          message += `- 240 AI requests\n`;
          message += `- Full premium commands\n`;
          message += `- Highest bandwidth & Priority support\n\n`;

          message += `💡 *To purchase, use:* \n`;
          message += `\`.buy <plan>\` (Example: \`.buy monthly\`)`;
        }

        return await reply(message);
      }
    } catch (error) {
      console.error('Premium Command Error:', error.message);
      return await reply('❌ Unable to connect to premium backend.');
    }
  }
};
