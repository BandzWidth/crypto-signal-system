const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const moment = require('moment');
const winston = require('winston');
const fs = require('fs');
require('dotenv').config();

// Import trading modules
const TradingEngine = require('./src/trading/TradingEngine');
const DataProvider = require('./src/data/DataProvider');
const SignalGenerator = require('./src/signals/SignalGenerator');
const AIOptimizer = require('./src/ai/AIOptimizer');
const TradeTracker = require('./src/trading/TradeTracker');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "https://s3.tradingview.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.socket.io",
        "https://www.tradingview.com",
      ],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://www.tradingview.com",
      ],
      "frame-src": [
        "'self'",
        "https://www.tradingview.com",
        "https://s.tradingview.com",
      ],
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https://s3.tradingview.com",
        "https://www.tradingview.com",
      ],
      "connect-src": [
        "'self'",
        "wss:",
        "ws:",
        "https://www.tradingview.com",
        "https://socket.tradingview.com",
        "https://symbols.tradingview.com",
      ],
      "font-src": [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Serve static files from React build if it exists
const reactBuildPath = path.join(__dirname, 'client', 'build');
if (fs.existsSync(reactBuildPath)) {
  console.log('✅ React build found, serving from:', reactBuildPath);
  app.use(express.static(reactBuildPath));
} else {
  console.log('⚠️ React build not found, serving from public directory');
  app.use(express.static(path.join(__dirname, 'public')));
}

// Initialize trading components
const dataProvider = new DataProvider();
const signalGenerator = new SignalGenerator();
const aiOptimizer = new AIOptimizer();
const tradeTracker = new TradeTracker();
const tradingEngine = new TradingEngine(dataProvider, signalGenerator, aiOptimizer, tradeTracker);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  socket.on('subscribe', (asset) => {
    socket.join(asset);
    logger.info(`Client ${socket.id} subscribed to ${asset}`);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// API Routes
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await dataProvider.getSupportedAssets();
    res.json(assets);
  } catch (error) {
    logger.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

app.get('/api/signals/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const signals = await tradingEngine.getActiveSignals(asset);
    res.json(signals);
  } catch (error) {
    logger.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.get('/api/history/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const history = await tradeTracker.getTradeHistory(asset);
    res.json(history);
  } catch (error) {
    logger.error('Error fetching trade history:', error);
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

app.get('/api/stats/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const stats = await dataProvider.getAssetStats(asset);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    reactBuildExists: fs.existsSync(reactBuildPath)
  });
});

// Serve React app for all other routes (must be last)
if (fs.existsSync(reactBuildPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
} else {
  // Fallback routes for when React build doesn't exist
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/bitcoin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bitcoin.html'));
  });

  app.get('/ethereum', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ethereum.html'));
  });

  app.get('/solana', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'solana.html'));
  });
}

// Scheduled tasks with intelligent timing
cron.schedule('*/5 * * * *', async () => {
  // Check market conditions every 5 minutes
  try {
    const dataProvider = new DataProvider();
    const isPeakHours = dataProvider.isPeakTradingHours();
    const isLowVolatility = dataProvider.isLowVolatilityPeriod();
    const isHighVolatility = dataProvider.isHighVolatilityPeriod();
    
    // Only run analysis during appropriate times
    if (!isLowVolatility) {
      await tradingEngine.runAnalysis();
      logger.info('Analysis completed successfully');
    } else {
      logger.info('Skipping analysis during low volatility period');
    }
  } catch (error) {
    logger.error('Analysis failed:', error);
  }
});

cron.schedule('0 */1 * * *', async () => {
  // AI optimization every hour (regardless of trading hours)
  try {
    await aiOptimizer.optimize();
    logger.info('AI optimization completed');
  } catch (error) {
    logger.error('AI optimization failed:', error);
  }
});

// Real-time data broadcasting
setInterval(async () => {
  try {
    const assets = ['BTC', 'ETH', 'SOL'];
    for (const asset of assets) {
      const data = await dataProvider.getRealTimeData(asset);
      io.to(asset).emit('marketData', data);
    }
  } catch (error) {
    logger.error('Error broadcasting market data:', error);
  }
}, 5000); // Update every 5 seconds

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  
  // Start the trading engine after server is ready
  tradingEngine.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
}); 