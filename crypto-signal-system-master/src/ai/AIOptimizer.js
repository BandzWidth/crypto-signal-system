const fs = require('fs').promises;
const path = require('path');

class AIOptimizer {
  constructor() {
    this.performanceData = new Map();
    this.strategyWeights = {
      'Range Trading': 1.0,
      'Scalping': 0.8,
      'Breakout Trading': 1.2,
      'Fibonacci Trading': 1.1,
      'Chart Pattern': 1.3
    };
    
    this.parameterRanges = {
      rsi: { oversold: [20, 40], overbought: [60, 80] },
      volume: { spike: [1.2, 3.0] },
      confidence: { min: [50, 80] },
      stopLoss: { range: [0.5, 2.0] },
      takeProfit: { range: [1.0, 5.0] }
    };
    
    this.learningRate = 0.01;
    this.dataFile = path.join(__dirname, '../../data/ai_performance.json');
    this.loadPerformanceData();
  }

  async loadPerformanceData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      this.performanceData = new Map(Object.entries(parsed));
    } catch (error) {
      console.log('No existing performance data found, starting fresh');
      this.performanceData = new Map();
    }
  }

  async savePerformanceData() {
    try {
      const data = Object.fromEntries(this.performanceData);
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving performance data:', error);
    }
  }

  async recordTradeOutcome(signal, outcome) {
    const key = `${signal.asset}_${signal.strategy}_${signal.timestamp}`;
    
    const performance = {
      signal,
      outcome,
      timestamp: Date.now(),
      profitLoss: outcome.profitLoss,
      success: outcome.profitLoss > 0,
      duration: outcome.exitTime - signal.timestamp
    };
    
    this.performanceData.set(key, performance);
    await this.savePerformanceData();
    
    // Update strategy weights based on outcome
    this.updateStrategyWeights(signal.strategy, performance);
  }

  updateStrategyWeights(strategy, performance) {
    const currentWeight = this.strategyWeights[strategy] || 1.0;
    
    if (performance.success) {
      // Increase weight for successful strategies
      this.strategyWeights[strategy] = Math.min(currentWeight * 1.05, 2.0);
    } else {
      // Decrease weight for unsuccessful strategies
      this.strategyWeights[strategy] = Math.max(currentWeight * 0.95, 0.5);
    }
  }

  async optimize() {
    console.log('Starting AI optimization...');
    
    // Analyze recent performance
    const recentTrades = await this.getRecentTrades(30); // Last 30 days
    const performanceByStrategy = this.analyzePerformanceByStrategy(recentTrades);
    const performanceByAsset = this.analyzePerformanceByAsset(recentTrades);
    const performanceByTimeframe = this.analyzePerformanceByTimeframe(recentTrades);
    
    // Optimize parameters based on performance
    this.optimizeParameters(performanceByStrategy);
    
    // Update strategy weights
    this.updateStrategyWeightsFromPerformance(performanceByStrategy);
    
    console.log('AI optimization completed');
    console.log('Updated strategy weights:', this.strategyWeights);
  }

  async getRecentTrades(days) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentTrades = [];
    
    for (const [key, performance] of this.performanceData) {
      if (performance.timestamp > cutoffTime) {
        recentTrades.push(performance);
      }
    }
    
    return recentTrades;
  }

  analyzePerformanceByStrategy(trades) {
    const performance = {};
    
    for (const trade of trades) {
      const strategy = trade.signal.strategy;
      
      if (!performance[strategy]) {
        performance[strategy] = {
          totalTrades: 0,
          successfulTrades: 0,
          totalProfitLoss: 0,
          averageProfitLoss: 0,
          winRate: 0
        };
      }
      
      performance[strategy].totalTrades++;
      performance[strategy].totalProfitLoss += trade.profitLoss;
      
      if (trade.success) {
        performance[strategy].successfulTrades++;
      }
    }
    
    // Calculate averages and win rates
    for (const strategy in performance) {
      const stats = performance[strategy];
      stats.averageProfitLoss = stats.totalProfitLoss / stats.totalTrades;
      stats.winRate = (stats.successfulTrades / stats.totalTrades) * 100;
    }
    
    return performance;
  }

  analyzePerformanceByAsset(trades) {
    const performance = {};
    
    for (const trade of trades) {
      const asset = trade.signal.asset;
      
      if (!performance[asset]) {
        performance[asset] = {
          totalTrades: 0,
          successfulTrades: 0,
          totalProfitLoss: 0,
          averageProfitLoss: 0,
          winRate: 0
        };
      }
      
      performance[asset].totalTrades++;
      performance[asset].totalProfitLoss += trade.profitLoss;
      
      if (trade.success) {
        performance[asset].successfulTrades++;
      }
    }
    
    // Calculate averages and win rates
    for (const asset in performance) {
      const stats = performance[asset];
      stats.averageProfitLoss = stats.totalProfitLoss / stats.totalTrades;
      stats.winRate = (stats.successfulTrades / stats.totalTrades) * 100;
    }
    
    return performance;
  }

  analyzePerformanceByTimeframe(trades) {
    const performance = {
      '15m': { totalTrades: 0, successfulTrades: 0, totalProfitLoss: 0 },
      '1h': { totalTrades: 0, successfulTrades: 0, totalProfitLoss: 0 },
      '4h': { totalTrades: 0, successfulTrades: 0, totalProfitLoss: 0 }
    };
    
    for (const trade of trades) {
      // Determine timeframe based on strategy
      let timeframe = '1h'; // Default
      
      if (trade.signal.strategy === 'Scalping') {
        timeframe = '15m';
      } else if (trade.signal.strategy === 'Breakout Trading') {
        timeframe = '4h';
      }
      
      performance[timeframe].totalTrades++;
      performance[timeframe].totalProfitLoss += trade.profitLoss;
      
      if (trade.success) {
        performance[timeframe].successfulTrades++;
      }
    }
    
    return performance;
  }

  optimizeParameters(performanceByStrategy) {
    // Optimize RSI levels based on performance
    for (const strategy in performanceByStrategy) {
      const stats = performanceByStrategy[strategy];
      
      if (stats.winRate > 60) {
        // Successful strategy - make parameters more aggressive
        this.parameterRanges.rsi.oversold[1] = Math.min(this.parameterRanges.rsi.oversold[1] + 1, 45);
        this.parameterRanges.rsi.overbought[0] = Math.max(this.parameterRanges.rsi.overbought[0] - 1, 55);
      } else if (stats.winRate < 40) {
        // Unsuccessful strategy - make parameters more conservative
        this.parameterRanges.rsi.oversold[1] = Math.max(this.parameterRanges.rsi.oversold[1] - 1, 35);
        this.parameterRanges.rsi.overbought[0] = Math.min(this.parameterRanges.rsi.overbought[0] + 1, 65);
      }
    }
  }

  updateStrategyWeightsFromPerformance(performanceByStrategy) {
    for (const strategy in performanceByStrategy) {
      const stats = performanceByStrategy[strategy];
      
      if (stats.totalTrades >= 5) { // Only update if we have enough data
        const currentWeight = this.strategyWeights[strategy] || 1.0;
        
        if (stats.winRate > 60 && stats.averageProfitLoss > 0) {
          // Increase weight for consistently profitable strategies
          this.strategyWeights[strategy] = Math.min(currentWeight * 1.1, 2.0);
        } else if (stats.winRate < 40 || stats.averageProfitLoss < 0) {
          // Decrease weight for unprofitable strategies
          this.strategyWeights[strategy] = Math.max(currentWeight * 0.9, 0.5);
        }
      }
    }
  }

  getOptimizedParameters() {
    return {
      strategyWeights: this.strategyWeights,
      parameterRanges: this.parameterRanges
    };
  }

  shouldGenerateSignal(asset, strategy, currentMarketConditions) {
    const weight = this.strategyWeights[strategy] || 1.0;
    
    // Check if market conditions are favorable
    const isPeakHours = currentMarketConditions.isPeakHours;
    const isLowVolatility = currentMarketConditions.isLowVolatility;
    const isHighVolatility = currentMarketConditions.isHighVolatility;
    
    // Adjust signal generation based on market conditions
    let adjustedWeight = weight;
    
    if (isPeakHours) {
      adjustedWeight *= 1.2; // More aggressive during peak hours
    }
    
    if (isLowVolatility) {
      adjustedWeight *= 0.7; // Less aggressive during low volatility
    }
    
    if (isHighVolatility) {
      adjustedWeight *= 1.3; // More aggressive during high volatility
    }
    
    // Generate signal if adjusted weight is above threshold
    return adjustedWeight > 0.8;
  }

  getPerformanceMetrics() {
    const metrics = {
      totalTrades: this.performanceData.size,
      strategyPerformance: {},
      assetPerformance: {},
      recentPerformance: {}
    };
    
    // Calculate overall metrics
    let totalProfitLoss = 0;
    let successfulTrades = 0;
    
    for (const [key, performance] of this.performanceData) {
      totalProfitLoss += performance.profitLoss;
      if (performance.success) {
        successfulTrades++;
      }
    }
    
    metrics.totalProfitLoss = totalProfitLoss;
    metrics.winRate = this.performanceData.size > 0 ? (successfulTrades / this.performanceData.size) * 100 : 0;
    metrics.averageProfitLoss = this.performanceData.size > 0 ? totalProfitLoss / this.performanceData.size : 0;
    
    return metrics;
  }

  async getStrategyRecommendations(asset) {
    const assetTrades = [];
    
    for (const [key, performance] of this.performanceData) {
      if (performance.signal.asset === asset) {
        assetTrades.push(performance);
      }
    }
    
    const performanceByStrategy = this.analyzePerformanceByStrategy(assetTrades);
    const recommendations = [];
    
    for (const [strategy, stats] of Object.entries(performanceByStrategy)) {
      if (stats.totalTrades >= 3) { // Only recommend if we have enough data
        recommendations.push({
          strategy,
          winRate: stats.winRate,
          averageProfitLoss: stats.averageProfitLoss,
          totalTrades: stats.totalTrades,
          recommendation: stats.winRate > 55 ? 'RECOMMENDED' : 'AVOID'
        });
      }
    }
    
    return recommendations.sort((a, b) => b.winRate - a.winRate);
  }
}

module.exports = AIOptimizer; 