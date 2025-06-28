// Shared Chart Component for all asset pages
class TradingViewChart {
    constructor(containerId, symbol, options = {}) {
        this.containerId = containerId;
        this.symbol = symbol;
        this.options = {
            height: '100%',
            width: '100%',
            theme: 'light',
            timeframes: ['15', '60', '240'],
            defaultTimeframe: '60',
            indicators: [
                'RSI@tv-basicstudies',
                'MACD@tv-basicstudies',
                'BB@tv-basicstudies',
                'Volume@tv-basicstudies',
                'VWAP@tv-basicstudies',
                'SMA@tv-basicstudies'
            ],
            ...options
        };
        
        this.chart = null;
        this.currentTimeframe = this.options.defaultTimeframe;
        this.isLoading = true;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }

    init() {
        this.createChartContainer();
        this.createLoadingIndicator();
        this.initializeChart();
    }

    createChartContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container ${this.containerId} not found`);
            return;
        }

        // Clear existing content
        container.innerHTML = '';
        
        // Create chart wrapper
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-wrapper';
        chartWrapper.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            background: var(--bg-primary);
            border-radius: 0.5rem;
            overflow: hidden;
        `;

        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.id = `${this.containerId}-chart`;
        chartContainer.style.cssText = `
            width: 100%;
            height: 100%;
            min-height: 600px;
        `;

        // Create loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = `${this.containerId}-loading`;
        loadingIndicator.className = 'chart-loading';
        loadingIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 5;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: var(--text-secondary);
        `;
        loadingIndicator.innerHTML = `
            <div class="loading-spinner" style="
                width: 40px;
                height: 40px;
                border: 3px solid var(--border-color);
                border-top: 3px solid var(--accent-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <div>Loading ${this.symbol} chart...</div>
        `;

        // Assemble the chart
        chartWrapper.appendChild(loadingIndicator);
        chartWrapper.appendChild(chartContainer);
        container.appendChild(chartWrapper);

        this.chartContainer = chartContainer;
        this.loadingIndicator = loadingIndicator;
    }

    createLoadingIndicator() {
        // Loading indicator is already created in createChartContainer
    }

    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
        this.isLoading = false;
    }

    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
        this.isLoading = true;
    }

    initializeChart() {
        console.log(`Initializing TradingView chart for ${this.symbol}...`);
        
        // Check if TradingView is loaded
        if (typeof TradingView === 'undefined') {
            console.error('TradingView library not loaded!');
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => {
                    this.initializeChart();
                }, 2000);
            } else {
                this.showError('Failed to load TradingView library');
            }
            return;
        }

        try {
            const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            
            this.chart = new TradingView.widget({
                "autosize": true,
                "symbol": this.symbol,
                "interval": this.currentTimeframe,
                "timezone": "Etc/UTC",
                "theme": theme,
                "style": "1",
                "locale": "en",
                "toolbar_bg": theme === 'dark' ? "#1e222d" : "#f1f3f6",
                "enable_publishing": false,
                "hide_side_toolbar": false,
                "allow_symbol_change": false,
                "container_id": `${this.containerId}-chart`,
                "studies": this.options.indicators,
                "show_popup_button": true,
                "popup_width": "1000",
                "popup_height": "650",
                "width": "100%",
                "height": "100%",
                "overrides": {
                    "mainSeriesProperties.candleStyle.upColor": "#26a69a",
                    "mainSeriesProperties.candleStyle.downColor": "#ef5350",
                    "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
                    "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
                },
                "loading_screen": { "backgroundColor": "transparent" }
            });

            console.log(`TradingView chart initialized successfully for ${this.symbol}`);
            
            // Hide loading after chart is ready
            setTimeout(() => {
                this.hideLoading();
            }, 3000);

        } catch (error) {
            console.error(`Error initializing TradingView chart for ${this.symbol}:`, error);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => {
                    this.initializeChart();
                }, 2000);
            } else {
                this.showError('Failed to initialize chart');
            }
        }
    }

    changeTimeframe(timeframe) {
        console.log(`Changing timeframe to ${timeframe} for ${this.symbol}`);
        this.currentTimeframe = timeframe;
        
        if (this.chart && this.chart.chart) {
            try {
                this.chart.chart().setResolution(timeframe);
                console.log(`Chart timeframe updated successfully for ${this.symbol}`);
            } catch (error) {
                console.error(`Error updating chart timeframe for ${this.symbol}:`, error);
                // Reinitialize chart if there's an error
                this.reinitializeChart();
            }
        } else {
            console.log(`Chart not ready for ${this.symbol}, reinitializing...`);
            this.reinitializeChart();
        }
    }

    reinitializeChart() {
        this.showLoading();
        setTimeout(() => {
            this.initializeChart();
        }, 1000);
    }

    showError(message) {
        if (this.loadingIndicator) {
            this.loadingIndicator.innerHTML = `
                <div style="color: var(--error-color); text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <div>${message}</div>
                    <button onclick="location.reload()" style="
                        margin-top: 12px;
                        padding: 8px 16px;
                        background: var(--accent-primary);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Retry</button>
                </div>
            `;
        }
    }

    updateTheme(theme) {
        if (this.chart && this.chart.chart) {
            try {
                this.chart.chart().applyOverrides({
                    "chartProperties.background": theme === 'dark' ? "#1e222d" : "#ffffff",
                    "chartProperties.textColor": theme === 'dark' ? "#ffffff" : "#000000"
                });
            } catch (error) {
                console.error('Error updating chart theme:', error);
            }
        }
    }

    destroy() {
        if (this.chart && this.chart.chart) {
            try {
                this.chart.chart().remove();
            } catch (error) {
                console.error('Error destroying chart:', error);
            }
        }
        this.chart = null;
    }
}

// Global chart instances and their configurations
window.chartInstances = new Map();
window.chartOptions = new Map();

function initializeAssetChart(containerId, symbol) {
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    const options = {
        "autosize": true,
        "symbol": symbol,
        "interval": "60",
        "timezone": "Etc/UTC",
        "theme": savedTheme,
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "container_id": containerId,
        "studies": [
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
            "BB@tv-basicstudies"
        ],
    };

    // Store options for later use
    window.chartOptions.set(containerId, options);

    // Create the widget
    const chart = new TradingView.widget(options);
    window.chartInstances.set(containerId, chart);
    
    return chart;
}

function updateChartTheme(containerId, theme) {
    const chart = window.chartInstances.get(containerId);
    const options = window.chartOptions.get(containerId);

    if (chart && options && options.theme !== theme) {
        // First, remove the old widget instance
        chart.remove();
        
        // Create a new widget with the updated theme
        const newOptions = { ...options, theme: theme };
        const newChart = new TradingView.widget(newOptions);
        
        // Store the new instance and options
        window.chartInstances.set(containerId, newChart);
        window.chartOptions.set(containerId, newOptions);
    }
}

// Destroy all charts
function destroyAllCharts() {
    window.chartInstances.forEach(chart => {
        chart.destroy();
    });
    window.chartInstances.clear();
} 