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

        let dashboard = `👑 *EDBOT PREMIUM DASHBOARD*

`;

        if (analyticsRes.data.success) {
          const data = analyticsRes.data.data;
          dashboard += `📊 *Analytics*
`;
          dashboard += `Total Users: ${data.total_premium_users}
`;
          dashboard += `Active Premium: ${data.active_premium_users}
`;
          dashboard += `Total Revenue: ₦${data.total_revenue.toLocaleString()}

`;
        }

        if (usersRes.data.success) {
          dashboard += `👥 *Premium Users*
`;
          const users = usersRes.data.users;
          if (users.length === 0) {
            dashboard += `No premium users yet.
`;
          } else {
            users.slice(0, 10).forEach((u, i) => {
              const expiry = moment(u.expires_at).format('YYYY-MM-DD');
              dashboard += `${i + 1}. @${u.user_id} (${u.plan}) - Exp: ${expiry}
`;
            });
            if (users.length > 10) dashboard += `...and ${users.length - 10} more.
`;
          }
        } else {
          dashboard += `❌ Failed to fetch analytics from backend.
`;
        }

        dashboard += `
_The system automatically manages expiry._`;
        return await reply(dashboard);
      } else {
        // PUBLIC VIEW
        const statusRes = await axios.get(`${BACKEND_BASE_URL}/api/premium/status?userId=${userId}`).catch(() => ({ data: { isPremium: false } }));
        const isPremium = statusRes.data.isPremium;

        let message = `🌟 *EDBOT PREMIUM SYSTEM*

`;

        if (isPremium) {
          const expiry = moment(statusRes.data.expiresAt).format('LLLL');
          message += `✅ *STATUS: PREMIUM ACTIVE*
`;
          message += `Plan: ${statusRes.data.plan.toUpperCase()}
`;
          message += `Expires: ${expiry}

`;
          message += `🚀 *Unlocked Benefits:*
`;
          message += `- Extended Anti-Ban protection
`;
          message += `- Priority AI processing
`;
          message += `- No message rate limits
`;
          message += `- Access to Premium commands
`;
        } else {
          message += `❌ *STATUS: FREE USER*

`;
          message += `Upgrade to Premium to unlock full potential and higher anti-ban limits!

`;
          message += `💎 *AVAILABLE PLANS:*
`;
          message += `1️⃣ *WEEKLY:* ₦500 (7 Days)
`;
          message += `2️⃣ *MONTHLY:* ₦1,500 (30 Days)
`;
          message += `3️⃣ *YEARLY:* ₦15,000 (365 Days)

`;
          message += `💡 *To purchase, use:* 
.buy <plan_name>
Example: \`.buy monthly\``;
        }

        return await reply(message);
      }
    } catch (error) {
      console.error('Premium Command Error:', error.message);
      return await reply('❌ Unable to connect to premium backend. Please try again later.');
    }
  }
};
