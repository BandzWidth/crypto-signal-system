// Dashboard JavaScript
class Dashboard {
    constructor() {
        this.socket = io();
        this.assets = ['BTC', 'ETH', 'SOL'];
        this.updateInterval = null;
        this.init();
    }

    async init() {
        this.setupSocketListeners();
        this.setupThemeToggle();
        await this.loadInitialData();
        this.startRealTimeUpdates();
        this.hideLoading();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('marketData', (data) => {
            this.updateAssetData(data);
        });
    }

    setupThemeToggle() {
        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.className = `${savedTheme}-mode`;
        this.updateThemeIcon(savedTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('.theme-toggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    async loadInitialData() {
        try {
            // Load system status
            const statusResponse = await fetch('/api/assets');
            const assets = await statusResponse.json();
            
            // Load asset overviews
            const assetPromises = this.assets.map(asset => 
                fetch(`/api/stats/${asset}`).then(res => res.json())
            );
            const assetData = await Promise.all(assetPromises);
            
            this.renderAssetsGrid(assets, assetData);
            this.renderPerformanceSummary();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    startRealTimeUpdates() {
        // Subscribe to all assets
        this.assets.forEach(asset => {
            this.socket.emit('subscribe', asset);
        });

        // Update data every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updateSystemStatus();
        }, 5000);
    }

    async updateSystemStatus() {
        try {
            // Update system status
            const statusResponse = await fetch('/api/assets');
            const assets = await statusResponse.json();
            
            // Update asset data
            const assetPromises = this.assets.map(asset => 
                fetch(`/api/stats/${asset}`).then(res => res.json())
            );
            const assetData = await Promise.all(assetPromises);
            
            this.updateStatusCards(assetData);
            this.updateAssetsGrid(assets, assetData);
            
        } catch (error) {
            console.error('Error updating system status:', error);
        }
    }

    updateConnectionStatus(isConnected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (statusDot && statusText) {
            statusDot.className = `status-dot ${isConnected ? 'online' : 'offline'}`;
            statusText.textContent = isConnected ? 'Live' : 'Offline';
        }
    }

    updateAssetData(data) {
        // Update specific asset data when received via socket
        const assetCard = document.querySelector(`[data-asset="${data.symbol}"]`);
        if (assetCard) {
            const priceElement = assetCard.querySelector('.price');
            const changeElement = assetCard.querySelector('.change');
            
            if (priceElement) {
                priceElement.textContent = this.formatPrice(data.price);
            }
            
            if (changeElement) {
                const changePercent = data.change || 0;
                changeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                changeElement.className = `change ${changePercent >= 0 ? 'positive' : 'negative'}`;
            }
        }
    }

    renderAssetsGrid(assets, assetData) {
        const grid = document.getElementById('assetsGrid');
        if (!grid) return;

        grid.innerHTML = assets.map((asset, index) => {
            const data = assetData[index] || {};
            const changePercent = data.change24h || 0;
            
            return `
                <div class="asset-card" data-asset="${asset}" onclick="window.location.href='/${asset.toLowerCase()}'">
                    <div class="asset-header">
                        <div class="asset-info">
                            <div class="asset-icon">
                                <i class="${this.getAssetIcon(asset)}"></i>
                            </div>
                            <div class="asset-details">
                                <h3>${this.getAssetName(asset)}</h3>
                                <p>${asset}</p>
                            </div>
                        </div>
                        <div class="asset-price">
                            <div class="price">${this.formatPrice(data.price || 0)}</div>
                            <div class="change ${changePercent >= 0 ? 'positive' : 'negative'}">
                                ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                    <div class="asset-stats">
                        <div class="asset-stat">
                            <span class="label">Volume</span>
                            <span class="value">${this.formatVolume(data.volume24h || 0)}</span>
                        </div>
                        <div class="asset-stat">
                            <span class="label">Market Cap</span>
                            <span class="value">${this.formatMarketCap(data.marketCap || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateAssetsGrid(assets, assetData) {
        assets.forEach((asset, index) => {
            const data = assetData[index] || {};
            const assetCard = document.querySelector(`[data-asset="${asset}"]`);
            
            if (assetCard) {
                const priceElement = assetCard.querySelector('.price');
                const changeElement = assetCard.querySelector('.change');
                const volumeElement = assetCard.querySelector('.asset-stat .value');
                
                if (priceElement) {
                    priceElement.textContent = this.formatPrice(data.price || 0);
                }
                
                if (changeElement) {
                    const changePercent = data.change24h || 0;
                    changeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    changeElement.className = `change ${changePercent >= 0 ? 'positive' : 'negative'}`;
                }
                
                if (volumeElement) {
                    volumeElement.textContent = this.formatVolume(data.volume24h || 0);
                }
            }
        });
    }

    updateStatusCards(assetData) {
        // Update active trades count
        const activeTradesElement = document.getElementById('activeTrades');
        if (activeTradesElement) {
            const totalActiveTrades = assetData.reduce((sum, data) => sum + (data.activeTrades || 0), 0);
            activeTradesElement.textContent = totalActiveTrades;
        }
    }

    async renderPerformanceSummary() {
        try {
            // Calculate overall performance from all assets
            const performancePromises = this.assets.map(asset => 
                fetch(`/api/history/${asset}`).then(res => res.json())
            );
            const allHistory = await Promise.all(performancePromises);
            
            const allTrades = allHistory.flat();
            const totalTrades = allTrades.length;
            const winningTrades = allTrades.filter(trade => trade.profitLoss > 0).length;
            const totalPnL = allTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
            const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
            
            // Find best strategy
            const strategyPerformance = {};
            allTrades.forEach(trade => {
                const strategy = trade.strategy;
                if (!strategyPerformance[strategy]) {
                    strategyPerformance[strategy] = { wins: 0, total: 0, pnl: 0 };
                }
                strategyPerformance[strategy].total++;
                strategyPerformance[strategy].pnl += trade.profitLoss || 0;
                if (trade.profitLoss > 0) {
                    strategyPerformance[strategy].wins++;
                }
            });
            
            const bestStrategy = Object.entries(strategyPerformance)
                .sort(([,a], [,b]) => (b.wins / b.total) - (a.wins / a.total))[0];
            
            // Update performance cards
            this.updateElement('totalTrades', totalTrades);
            this.updateElement('overallWinRate', `${winRate.toFixed(1)}%`);
            this.updateElement('totalPnL', `$${totalPnL.toFixed(2)}`);
            this.updateElement('bestStrategy', bestStrategy ? bestStrategy[0] : '-');
            this.updateElement('aiWinRate', `${winRate.toFixed(1)}%`);
            
        } catch (error) {
            console.error('Error rendering performance summary:', error);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    getAssetIcon(asset) {
        const icons = {
            'BTC': 'fab fa-bitcoin',
            'ETH': 'fab fa-ethereum',
            'SOL': 'fas fa-coins'
        };
        return icons[asset] || 'fas fa-coins';
    }

    getAssetName(asset) {
        const names = {
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'SOL': 'Solana'
        };
        return names[asset] || asset;
    }

    formatPrice(price) {
        if (price >= 1000) {
            return `$${(price / 1000).toFixed(2)}K`;
        }
        return `$${price.toFixed(2)}`;
    }

    formatVolume(volume) {
        if (volume >= 1e9) {
            return `$${(volume / 1e9).toFixed(2)}B`;
        } else if (volume >= 1e6) {
            return `$${(volume / 1e6).toFixed(2)}M`;
        } else if (volume >= 1e3) {
            return `$${(volume / 1e3).toFixed(2)}K`;
        }
        return `$${volume.toFixed(2)}`;
    }

    formatMarketCap(marketCap) {
        if (marketCap >= 1e12) {
            return `$${(marketCap / 1e12).toFixed(2)}T`;
        } else if (marketCap >= 1e9) {
            return `$${(marketCap / 1e9).toFixed(2)}B`;
        } else if (marketCap >= 1e6) {
            return `$${(marketCap / 1e6).toFixed(2)}M`;
        }
        return `$${marketCap.toFixed(2)}`;
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Global theme toggle function
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    body.className = `${newTheme}-mode`;
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const icon = document.querySelector('.theme-toggle i');
    if (icon) {
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
}); 