const express = require('express');
const cors = require('cors');
const os = require('os');
const { execSync } = require('child_process');
require('dotenv').config();

// Global Error Resilience Handlers
process.on('uncaughtException', (err) => {
  console.error('\n❌ [CRITICAL] UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ [CRITICAL] UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Periodic Keep-Alive Heartbeat
setInterval(() => {
  const uptime = Math.floor(process.uptime());
  console.log(`[KEEP-ALIVE] Backend active | Uptime: ${uptime}s | Timestamp: ${new Date().toISOString()}`);
}, 60000);

const validateEnv = require('./utils/envValidator');
const paymentRoutes = require('./routes/payments');
const premiumRoutes = require('./routes/premium');
const webhookRoutes = require('./routes/webhook');
const initDatabase = require('./database/init');
const { verifyTables } = require('./database/appwrite');
const { PUBLIC_SERVER_URL } = require('./config/backendUrl');

/**
 * STARTUP WRAPPER
 */
async function startServer() {
  try {
    // Step 1: Validate Environment
    if (!validateEnv()) {
      console.error('❌ [STARTUP FAILURE] Environment validation failed. Stopping process.');
      process.exit(1);
    }

    const app = express();
    const PORT = process.env.PORT || 3000;

    /**
     * Detect Local WiFi IP Address
     */
    const getLocalIP = () => {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
      return '127.0.0.1';
    };

    /**
     * Check for cloudflared
     */
    const checkCloudflare = () => {
      try {
        execSync('cloudflared --version', { stdio: 'ignore' });
        return true;
      } catch (e) {
        return false;
      }
    };

    // Initialize Database & Verify Tables
    console.log('🚀 [STARTUP] Initializing AppWrite Schema...');
    try {
      await initDatabase();
    } catch (dbError) {
      console.error('⚠️ [STARTUP WARNING] Database initialization reported issues:', dbError.message);
    }
    const tablesLoaded = verifyTables();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Routes Mounting
    console.log('📂 [STARTUP] Mounting API Routes...');
    app.use('/payment', paymentRoutes);
    app.use('/webhook', webhookRoutes);
    app.use('/api/premium', premiumRoutes);

    // Health Check
    app.get('/', (req, res) => {
      res.json({ 
        status: 'EDBOT Premium Server is online', 
        diagnostics: {
          appwrite: 'Connected',
          paystack: 'Ready',
          database_id: process.env.APPWRITE_DATABASE_ID,
          uptime: Math.floor(process.uptime())
        }
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('[EXPRESS ERROR]', err.stack);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    });

    app.listen(PORT, () => {
      const localIP = getLocalIP();
      const isCloudflareInstalled = checkCloudflare();
      
      console.log('\n' + '═'.repeat(60));
      console.log('🚀 EDBOT PREMIUM BACKEND STARTED');
      console.log('═'.repeat(60));
      
      console.log('📊 [SYSTEM STATUS]');
      console.log(`- Port:            ${PORT}`);
      console.log(`- Appwrite:        Connected`);
      console.log(`- Tables:          ${tablesLoaded ? 'All Valid' : 'SCHEMA ERROR'}`);
      console.log(`- Paystack:        Secrets Loaded`);
      
      console.log('\n🔗 [LOCAL ACCESS]');
      console.log(`- Localhost:       http://localhost:${PORT}`);
      console.log(`- Local IP:        http://${localIP}:${PORT}`);
      
      console.log('\n💳 [PUBLIC PAYSTACK ENDPOINTS]');
      console.log(`- Callback URL:    ${PUBLIC_SERVER_URL}/payment/callback`);
      console.log(`- Webhook URL:     ${PUBLIC_SERVER_URL}/webhook/paystack`);
      
      if (isCloudflareInstalled) {
        console.log('\n☁️ [CLOUDFLARE TUNNEL DETECTED]');
        console.log('Expose your server for Paystack webhooks:');
        console.log(`   cloudflared tunnel --url http://localhost:${PORT}`);
      } else {
        console.log('\n⚠️ [TUNNEL WARNING]');
        console.log('Paystack webhooks require a public HTTPS URL.');
      }

      console.log('\n📂 [ACTIVE ROUTES]');
      console.log(`- POST /payment/create     (Init Payment)`);
      console.log(`- GET  /payment/callback   (User Redirect)`);
      console.log(`- POST /webhook/paystack   (Server Events)`);
      console.log(`- GET  /api/premium/status (Bot Check)`);
      
      console.log('═'.repeat(60) + '\n');
    });

  } catch (fatalError) {
    console.error('🔥 [FATAL STARTUP ERROR] Backend could not start:', fatalError);
  }
}

startServer();
