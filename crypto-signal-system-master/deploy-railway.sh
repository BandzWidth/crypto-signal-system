#!/bin/bash

# Railway Deployment Script for Crypto Signal System

echo "🚀 Preparing Crypto Signal System for Railway deployment..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run:"
    echo "railway login"
    exit 1
fi

echo "✅ Railway CLI found and authenticated"

# Build and deploy
echo "🔨 Building and deploying to Railway..."
railway up

echo "✅ Deployment completed!"
echo "🌐 Your app should be available at the URL shown above"
echo "📊 Check the Railway dashboard for deployment status and logs" 