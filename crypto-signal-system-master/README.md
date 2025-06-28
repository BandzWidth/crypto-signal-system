# Trading Signal System

An AI-powered crypto trading signal system with real-time market analysis and automated trading capabilities.

## Features

- Real-time cryptocurrency price monitoring (BTC, ETH, SOL)
- AI-powered trading signal generation
- Automated trading engine with strategy optimization
- Web-based dashboard with TradingView charts
- Mobile-responsive interface
- 24/7 continuous operation

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd trading-signal-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   - Open http://localhost:3000 in your browser
   - The system will start fetching real-time data automatically

## Deployment Options

### Option 1: Railway (Recommended - Free)

1. **Create a Railway account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy your project**
   - Connect your GitHub repository
   - Railway will automatically detect it's a Node.js app
   - Deploy with one click

3. **Set environment variables** (if needed)
   - Add any API keys in Railway dashboard
   - The app will work without CoinAPI (uses CryptoCompare as fallback)

4. **Access your live app**
   - Railway provides a public URL
   - Your app will run 24/7

### Option 2: Render (Also Free)

1. **Create a Render account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create a new Web Service**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Deploy**
   - Render will automatically deploy your app
   - Get a public URL for 24/7 access

### Option 3: Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

4. **Open your app**
   ```bash
   heroku open
   ```

## Environment Variables

The system works without any API keys, but you can add these for enhanced functionality:

- `COINAPI_KEY` - CoinAPI key for additional data sources
- `PORT` - Server port (default: 3000)

## System Architecture

- **Backend**: Node.js with Express
- **Frontend**: HTML/CSS/JavaScript with TradingView charts
- **AI Engine**: Continuous optimization and signal generation
- **Data Sources**: CryptoCompare API (primary), CoinAPI (optional)
- **Real-time Updates**: WebSocket connections for live data

## Features

### Dashboard
- Real-time asset overview
- Performance metrics
- Live trading signals
- System status monitoring

### Asset Pages
- Interactive TradingView charts
- Multiple timeframes (15m, 1h, 4h)
- Technical indicators
- Trade history

### AI System
- 24/7 continuous operation
- Hourly strategy optimization
- Real-time market analysis
- Automated trade execution

## Mobile Access

Once deployed, you can access your trading system from:
- Any web browser on your phone
- Tablet or laptop
- Any device with internet access

## Monitoring

The system includes:
- Automatic error handling
- Performance logging
- Real-time status updates
- Data source fallbacks

## Support

For issues or questions:
1. Check the logs in your deployment platform
2. Ensure all dependencies are installed
3. Verify environment variables are set correctly

## License

MIT License - feel free to modify and distribute. 