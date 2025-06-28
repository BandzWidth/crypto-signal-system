# Railway Deployment Script for Crypto Signal System (PowerShell)

Write-Host "🚀 Preparing Crypto Signal System for Railway deployment..." -ForegroundColor Green

# Check if Railway CLI is installed
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI found: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in to Railway
try {
    railway whoami | Out-Null
    Write-Host "✅ Authenticated with Railway" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged in to Railway. Please run:" -ForegroundColor Red
    Write-Host "railway login" -ForegroundColor Yellow
    exit 1
}

# Build and deploy
Write-Host "🔨 Building and deploying to Railway..." -ForegroundColor Green
railway up

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Your app should be available at the URL shown above" -ForegroundColor Cyan
Write-Host "📊 Check the Railway dashboard for deployment status and logs" -ForegroundColor Cyan 