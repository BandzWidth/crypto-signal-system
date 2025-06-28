# Trading Signal System Deployment Script for Windows
# This script ensures 24/7 operation of your trading signal system

param(
    [switch]$Force
)

Write-Host "🚀 Starting Trading Signal System Deployment..." -ForegroundColor Green

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
}

# Check Node.js version
$nodeMajor = (node --version).Split('.')[0].TrimStart('v')
if ([int]$nodeMajor -lt 16) {
    Write-Error "Node.js version 16 or higher is required. Current version: $(node --version)"
    exit 1
}

# Create necessary directories
Write-Status "Creating necessary directories..."
if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" }
if (!(Test-Path "data")) { New-Item -ItemType Directory -Path "data" }

# Install dependencies
Write-Status "Installing dependencies..."
npm install

# Install PM2 globally if not already installed
try {
    pm2 --version | Out-Null
    Write-Status "PM2 is already installed"
} catch {
    Write-Status "Installing PM2 process manager..."
    npm install -g pm2
}

# Stop existing PM2 processes
Write-Status "Stopping existing processes..."
try {
    pm2 stop trading-signal-system 2>$null
    pm2 delete trading-signal-system 2>$null
} catch {
    # Process might not exist, which is fine
}

# Start the application with PM2
Write-Status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
Write-Status "Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
Write-Status "Setting up PM2 startup script..."
try {
    pm2 startup 2>$null
} catch {
    Write-Warning "PM2 startup setup may require administrator privileges"
}

# Wait a moment for the application to start
Start-Sleep -Seconds 5

# Check if the application is running
$pm2Status = pm2 list
if ($pm2Status -match "trading-signal-system.*online") {
    Write-Status "✅ Application started successfully!"
    Write-Status "📊 PM2 Status:"
    pm2 list
    Write-Status "📝 Logs: pm2 logs trading-signal-system"
    Write-Status "🖥️  Monitor: pm2 monit"
} else {
    Write-Error "❌ Application failed to start"
    Write-Status "Checking logs..."
    pm2 logs trading-signal-system --lines 20
    exit 1
}

# Display useful commands
Write-Host ""
Write-Status "Useful commands:"
Write-Host "  pm2 logs trading-signal-system    # View logs" -ForegroundColor Cyan
Write-Host "  pm2 monit                         # Monitor processes" -ForegroundColor Cyan
Write-Host "  pm2 restart trading-signal-system # Restart application" -ForegroundColor Cyan
Write-Host "  pm2 stop trading-signal-system    # Stop application" -ForegroundColor Cyan
Write-Host "  pm2 delete trading-signal-system  # Remove from PM2" -ForegroundColor Cyan

Write-Host ""
Write-Status "🎉 Deployment completed! Your trading signal system is now running 24/7!"
Write-Status "🌐 Access your application at: http://localhost:3000" 