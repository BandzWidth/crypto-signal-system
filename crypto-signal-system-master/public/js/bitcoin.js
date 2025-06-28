// Bitcoin Page JavaScript
class BitcoinPage {
    constructor() {
        this.socket = io();
        this.asset = 'BTC';
        this.chart = null;
        this.updateInterval = null;
        this.init();
    }

    async init() {
        console.log('Initializing Bitcoin page...');
        this.setupSocketListeners();
        this.setupThemeToggle();
        await this.loadInitialData();
        this.renderTimeframeButtons();
        this.initializeChart();
        this.startRealTimeUpdates();
        this.hideLoading();
        console.log('Bitcoin page initialization complete');
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('subscribe', this.asset);
        });

        this.socket.on('marketData', (data) => {
            if (data.symbol === this.asset) {
                this.updateMarketData(data);
            }
        });
    }

    setupThemeToggle() {
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
            // Load asset stats
            const statsResponse = await fetch(`/api/stats/${this.asset}`);
            const stats = await statsResponse.json();
            this.updateAssetStats(stats);

            // Load active trades
            const signalsResponse = await fetch(`/api/signals/${this.asset}`);
            const signals = await signalsResponse.json();
            this.renderActiveTrades(signals.activeTrades);

            // Load trade history
            const historyResponse = await fetch(`/api/history/${this.asset}`);
            const history = await historyResponse.json();
            this.renderTradeHistory(history);

            // Load strategy performance
            this.renderStrategyPerformance();

        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    renderTimeframeButtons() {
        const container = document.getElementById('timeframe-controls-external');
        if (!container) return;
        container.innerHTML = '';
        const timeframes = [
            { value: '15', label: '15m' },
            { value: '60', label: '1h' },
            { value: '240', label: '4h' }
        ];
        timeframes.forEach(tf => {
            const btn = document.createElement('button');
            btn.className = 'timeframe-btn';
            btn.textContent = tf.label;
            btn.dataset.timeframe = tf.value;
            btn.onclick = () => {
                if (this.chart && typeof this.chart.changeTimeframe === 'function') {
                    this.chart.changeTimeframe(tf.value);
                    this.updateTimeframeButtons(tf.value);
                }
            };
            container.appendChild(btn);
        });
        this.updateTimeframeButtons('60');
    }

    updateTimeframeButtons(active) {
        const container = document.getElementById('timeframe-controls-external');
        if (!container) return;
        const buttons = container.querySelectorAll('.timeframe-btn');
        buttons.forEach(btn => {
            const isActive = btn.dataset.timeframe === active;
            btn.style.background = isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)';
            btn.style.color = isActive ? 'white' : 'var(--text-primary)';
        });
    }

    initializeChart() {
        console.log('Initializing TradingView chart for Bitcoin...');
        // Use the TradingViewChart class for full control
        this.chart = new TradingViewChart('tradingview-chart', 'BINANCE:BTCUSDT', { defaultTimeframe: '60' });
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateData();
        }, 5000);
    }

    async updateData() {
        try {
            // Update asset stats
            const statsResponse = await fetch(`/api/stats/${this.asset}`);
            const stats = await statsResponse.json();
            this.updateAssetStats(stats);

            // Update active trades
            const signalsResponse = await fetch(`/api/signals/${this.asset}`);
            const signals = await signalsResponse.json();
            this.renderActiveTrades(signals.activeTrades);

        } catch (error) {
            console.error('Error updating data:', error);
        }
    }

    updateMarketData(data) {
        if (!data) return;

        this.updateElement('currentPrice', this.formatCurrency(data.price));
        this.updateElement('marketCap', this.formatMarketCap(data.marketCap));
        this.updateElement('volume24h', this.formatVolume(data.volume));
        this.updateElement('high24h', this.formatCurrency(data.high));
        this.updateElement('low24h', this.formatCurrency(data.low));
        
        const priceChangeElement = document.getElementById('priceChange');
        if (priceChangeElement) {
            const changePercent = data.change || 0;
            priceChangeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            priceChangeElement.className = `stat-value ${changePercent >= 0 ? 'positive' : 'negative'}`;
        }
    }

    updateAssetStats(stats) {
        if (!stats) return;

        this.updateElement('currentPrice', this.formatCurrency(stats.price));
        this.updateElement('marketCap', this.formatMarketCap(stats.marketCap));
        this.updateElement('volume24h', this.formatVolume(stats.volume24h));
        this.updateElement('high24h', this.formatCurrency(stats.high24h));
        this.updateElement('low24h', this.formatCurrency(stats.low24h));
        
        const priceChangeElement = document.getElementById('priceChange');
        if (priceChangeElement) {
            const changePercent = stats.change24h || 0;
            priceChangeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            priceChangeElement.className = `stat-value ${changePercent >= 0 ? 'positive' : 'negative'}`;
        }
    }

    renderActiveTrades(trades) {
        const container = document.getElementById('activeTrades');
        if (!container) return;

        if (trades.length === 0) {
            container.innerHTML = '<p class="no-trades">No active trades</p>';
            return;
        }

        container.innerHTML = trades.map(trade => `
            <div class="trade-card">
                <div class="trade-info">
                    <div class="trade-type ${trade.type.toLowerCase()}">
                        ${trade.type}
                    </div>
                    <div class="trade-details">
                        <h4>${trade.strategy}</h4>
                        <p>Entry: ${this.formatPrice(trade.entryPrice)}</p>
                    </div>
                </div>
                <div class="trade-metrics">
                    <div class="price">${this.formatPrice(trade.entryPrice)}</div>
                    <div class="pnl">
                        SL: ${this.formatPrice(trade.stopLoss)} | TP: ${this.formatPrice(trade.takeProfit)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderTradeHistory(history) {
        const tableBody = document.getElementById('historyTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = history.map(trade => `
            <tr>
                <td>${new Date(trade.entryTime).toLocaleDateString()}</td>
                <td>${trade.strategy}</td>
                <td>${trade.type}</td>
                <td>${this.formatPrice(trade.entryPrice)}</td>
                <td>${trade.exitPrice ? this.formatPrice(trade.exitPrice) : '-'}</td>
                <td class="pnl ${trade.profitLoss >= 0 ? 'positive' : 'negative'}">
                    ${trade.profitLoss ? `${trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}%` : '-'}
                </td>
                <td>${this.formatDuration(trade.duration)}</td>
                <td>${trade.status}</td>
            </tr>
        `).join('');
    }

    async renderStrategyPerformance() {
        try {
            const historyResponse = await fetch(`/api/history/${this.asset}`);
            const history = await historyResponse.json();
            
            const strategyStats = {};
            history.forEach(trade => {
                const strategy = trade.strategy;
                if (!strategyStats[strategy]) {
                    strategyStats[strategy] = { wins: 0, total: 0, pnl: 0 };
                }
                strategyStats[strategy].total++;
                strategyStats[strategy].pnl += trade.profitLoss || 0;
                if (trade.profitLoss > 0) {
                    strategyStats[strategy].wins++;
                }
            });

            const container = document.getElementById('strategyPerformance');
            if (!container) return;

            container.innerHTML = Object.entries(strategyStats).map(([strategy, stats]) => {
                const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
                const avgPnL = stats.total > 0 ? stats.pnl / stats.total : 0;
                
                return `
                    <div class="strategy-card">
                        <h3>${strategy}</h3>
                        <div class="strategy-metrics">
                            <div class="strategy-metric">
                                <div class="value">${winRate.toFixed(1)}%</div>
                                <div class="label">Win Rate</div>
                            </div>
                            <div class="strategy-metric">
                                <div class="value">${stats.total}</div>
                                <div class="label">Trades</div>
                            </div>
                            <div class="strategy-metric">
                                <div class="value">${avgPnL >= 0 ? '+' : ''}${avgPnL.toFixed(2)}%</div>
                                <div class="label">Avg P&L</div>
                            </div>
                            <div class="strategy-metric">
                                <div class="value">${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}%</div>
                                <div class="label">Total P&L</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error rendering strategy performance:', error);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    formatCurrency(value) {
        if (typeof value !== 'number') return '$0.00';
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatMarketCap(marketCap) {
        if (typeof marketCap !== 'number') return '$0';
        if (marketCap >= 1e12) {
            return `$${(marketCap / 1e12).toFixed(2)}T`;
        }
        if (marketCap >= 1e9) {
            return `$${(marketCap / 1e9).toFixed(2)}B`;
        }
        if (marketCap >= 1e6) {
            return `$${(marketCap / 1e6).toFixed(2)}M`;
        }
        return `$${marketCap.toLocaleString('en-US')}`;
    }

    formatPrice(price) {
        if (typeof price !== 'number') return '$0.00';
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatVolume(volume) {
        if (typeof volume !== 'number') return '$0';
        if (volume >= 1e12) {
            return `$${(volume / 1e12).toFixed(2)}T`;
        }
        if (volume >= 1e9) {
            return `$${(volume / 1e9).toFixed(2)}B`;
        }
        if (volume >= 1e6) {
            return `$${(volume / 1e6).toFixed(2)}M`;
        }
        return `$${volume.toLocaleString('en-US')}`;
    }

    formatDuration(duration) {
        if (!duration) return '-';
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
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
        // Clean up chart instance
        if (window.chartInstances && window.chartInstances.has('tradingview-chart')) {
            const chart = window.chartInstances.get('tradingview-chart');
            chart.destroy();
            window.chartInstances.delete('tradingview-chart');
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
    
    // Update all charts theme
    updateAllChartsTheme(newTheme);
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bitcoinPage = new BitcoinPage();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.bitcoinPage) {
        window.bitcoinPage.destroy();
    }
}); 