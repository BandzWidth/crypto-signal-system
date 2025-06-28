# Railway Deployment Guide

This guide will help you deploy the Crypto Signal System to Railway.

## Prerequisites

1. A Railway account (sign up at [railway.app](https://railway.app))
2. Git repository with your code
3. Railway CLI (optional but recommended)

## Deployment Steps

### 1. Connect Your Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository
5. Railway will automatically detect the Dockerfile and start building

### 2. Environment Variables

Set the following environment variables in Railway Dashboard:

**Required Variables:**
```
NODE_ENV=production
LOG_LEVEL=info
SESSION_SECRET=your_secure_random_string_here
```

**Trading Configuration:**
```
MIN_CONFIDENCE_THRESHOLD=70
MAX_ACTIVE_TRADES_PER_ASSET=3
SIGNAL_GENERATION_INTERVAL=900000
AI_OPTIMIZATION_INTERVAL=3600000
DATA_UPDATE_INTERVAL=5000
OHLCV_LIMIT=100
```

**Risk Management:**
```
DEFAULT_STOP_LOSS_PERCENT=1.0
DEFAULT_TAKE_PROFIT_PERCENT=2.0
MAX_RISK_PER_TRADE_PERCENT=2.0
```

**AI Configuration:**
```
AI_LEARNING_RATE=0.01
AI_PERFORMANCE_DAYS=30
AI_MIN_TRADES_FOR_OPTIMIZATION=5
```

**WebSocket Configuration:**
```
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_RECONNECT_ATTEMPTS=5
```

**Security:**
```
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Custom Domain (Optional)

1. In Railway Dashboard, go to your project
2. Click on "Settings" tab
3. Under "Domains", add your custom domain
4. Configure DNS records as instructed

### 4. Monitoring

The application includes:
- Health check endpoint at `/health`
- Winston logging configured for production
- Automatic restarts on failure
- Real-time monitoring through Railway dashboard

## Deployment Files

### railway.json
Configuration file for Railway deployment settings.

### Dockerfile
Multi-stage Docker build optimized for production.

### .dockerignore
Excludes unnecessary files from Docker build context.

### healthcheck.js
Health check script for container monitoring.

## Post-Deployment

1. **Verify Deployment**: Check the Railway dashboard for successful deployment
2. **Test Health Check**: Visit `https://your-app.railway.app/health`
3. **Monitor Logs**: Use Railway's log viewer to monitor application performance
4. **Set Up Alerts**: Configure Railway notifications for deployment status

## Troubleshooting

### Common Issues

1. **Build Failures**: Check that all dependencies are in package.json
2. **Port Issues**: Railway automatically assigns PORT environment variable
3. **Memory Issues**: Monitor resource usage in Railway dashboard
4. **Health Check Failures**: Verify the `/health` endpoint is working

### Logs

Access logs through:
- Railway Dashboard → Your Project → Deployments → View Logs
- Or use Railway CLI: `railway logs`

### Scaling

Railway automatically scales based on traffic. You can also manually adjust:
- Railway Dashboard → Your Project → Settings → Scale

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to Git
2. **Session Secret**: Use a strong, random string for SESSION_SECRET
3. **CORS**: Configure CORS_ORIGIN appropriately for production
4. **Rate Limiting**: Adjust rate limits based on expected traffic

## Performance Optimization

1. **Caching**: Consider adding Redis for session storage
2. **CDN**: Use Railway's built-in CDN for static assets
3. **Database**: Add PostgreSQL or MongoDB if needed for data persistence
4. **Monitoring**: Set up external monitoring (e.g., Sentry, LogRocket)

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Application Issues: Check the project's GitHub issues 