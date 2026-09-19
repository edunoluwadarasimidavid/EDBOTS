/**
 * Broadcast Command - Send message to all chats with rate limiting
 * Built-in anti-spam: delays between messages prevent bulk sending bans
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: 'broadcast',
    aliases: ['bc'],
    category: 'owner',
    description: 'Broadcast message to all groups',
    usage: '.broadcast <message>',
    ownerOnly: true,
    
    async execute(sock, msg, args, extra) {
      try {
        if (args.length === 0) {
          return extra.reply('❌ Usage: .broadcast <message>\n\nExample: .broadcast Hello everyone!');
        }
        
        const message = args.join(' ');
        
        await extra.reply('📢 Starting broadcast to all groups...');
        
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);
        
        if (groups.length === 0) {
          return extra.reply('❌ No groups found to broadcast to.');
        }
        
        let success = 0;
        let failed = 0;
        
        for (const group of groups) {
          try {
            // Human-like delay between each group message (2-4 seconds)
            // This prevents WhatsApp from detecting automated bulk sending
            const sendDelay = 2000 + Math.floor(Math.random() * 2000);
            await delay(sendDelay);
            
            await sock.sendMessage(group.id, {
              text: `📢 *BROADCAST MESSAGE*\n\n${message}\n\n_This is an official message from the bot owner_`
            });
            success++;
            console.log(`[BROADCAST] Sent to ${group.subject} (${success}/${groups.length})`);
          } catch (e) {
            failed++;
            console.error(`[BROADCAST] Failed to send to ${group.subject}: ${e.message}`);
          }
        }
        
        await extra.reply(`✅ Broadcast complete!\n\n✅ Sent: ${success}\n❌ Failed: ${failed}\n📋 Total groups: ${groups.length}`);
        
      } catch (error) {
        await extra.reply(`❌ Error: ${error.message}`);
      }
    }
  };
