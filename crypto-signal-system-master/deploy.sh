#!/bin/bash

# Trading Signal System Deployment Script
# This script ensures 24/7 operation of your trading signal system

set -e  # Exit on any error

echo "🚀 Starting Trading Signal System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p data

# Install dependencies
print_status "Installing dependencies..."
npm install

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2 process manager..."
    npm install -g pm2
fi

# Stop existing PM2 processes
print_status "Stopping existing processes..."
pm2 stop trading-signal-system 2>/dev/null || true
pm2 delete trading-signal-system 2>/dev/null || true

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
print_status "Setting up PM2 startup script..."
pm2 startup 2>/dev/null || true

# Wait a moment for the application to start
sleep 5

# Check if the application is running
if pm2 list | grep -q "trading-signal-system.*online"; then
    print_status "✅ Application started successfully!"
    print_status "📊 PM2 Status:"
    pm2 list
    print_status "📝 Logs: pm2 logs trading-signal-system"
    print_status "🖥️  Monitor: pm2 monit"
else
    print_error "❌ Application failed to start"
    print_status "Checking logs..."
    pm2 logs trading-signal-system --lines 20
    exit 1
fi

# Display useful commands
echo ""
print_status "Useful commands:"
echo "  pm2 logs trading-signal-system    # View logs"
echo "  pm2 monit                         # Monitor processes"
echo "  pm2 restart trading-signal-system # Restart application"
echo "  pm2 stop trading-signal-system    # Stop application"
echo "  pm2 delete trading-signal-system  # Remove from PM2"

echo ""
print_status "🎉 Deployment completed! Your trading signal system is now running 24/7!"
print_status "🌐 Access your application at: http://localhost:3000" 