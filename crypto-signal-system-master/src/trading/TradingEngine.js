const moment = require('moment');

class TradingEngine {
  constructor(dataProvider, signalGenerator, aiOptimizer, tradeTracker) {
    this.dataProvider = dataProvider;
    this.signalGenerator = signalGenerator;
    this.aiOptimizer = aiOptimizer;
    this.tradeTracker = tradeTracker;
    
    this.supportedAssets = ['BTC', 'ETH', 'SOL'];
    this.isRunning = false;
    this.lastAnalysis = new Map();
  }

  async start() {
    if (this.isRunning) {
      console.log('Trading engine is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('Trading engine started');
    
    // Initial analysis
    await this.runAnalysis();
  }

  async stop() {
    this.isRunning = false;
    console.log('Trading engine stopped');
  }

  async runAnalysis() {
    if (!this.isRunning) return;
    
    console.log('Running market analysis...');
    
    for (const asset of this.supportedAssets) {
      try {
        await this.analyzeAsset(asset);
      } catch (error) {
        console.error(`Error analyzing ${asset}:`, error);
      }
    }
    
    console.log('Market analysis completed');
  }

  async analyzeAsset(asset) {
    // Get multi-timeframe data
    const data = await this.dataProvider.getMultiTimeframeData(asset);
    
    // Check market conditions
    const marketConditions = {
      isPeakHours: this.dataProvider.isPeakTradingHours(),
      isLowVolatility: this.dataProvider.isLowVolatilityPeriod(),
      isHighVolatility: this.dataProvider.isHighVolatilityPeriod()
    };
    
    // Skip analysis during low volatility periods
    if (marketConditions.isLowVolatility) {
      console.log(`Skipping ${asset} analysis during low volatility period`);
      return;
    }
    
    // Generate signals only during appropriate market conditions
    let signals = [];
    
    if (marketConditions.isPeakHours) {
      // More aggressive signal generation during peak hours
      console.log(`Running aggressive analysis for ${asset} during peak hours`);
      signals = await this.signalGenerator.generateSignals(asset, data);
    } else if (!marketConditions.isHighVolatility) {
      // Conservative signal generation during normal hours
      console.log(`Running conservative analysis for ${asset} during normal hours`);
      signals = await this.signalGenerator.generateSignals(asset, data, { conservative: true });
    } else {
      // Very conservative during high volatility periods
      console.log(`Running very conservative analysis for ${asset} during high volatility`);
      signals = await this.signalGenerator.generateSignals(asset, data, { veryConservative: true });
    }
    
    // Filter signals using AI optimization
    const filteredSignals = [];
    
    for (const signal of signals) {
      const shouldGenerate = this.aiOptimizer.shouldGenerateSignal(
        asset, 
        signal.strategy, 
        marketConditions
      );
      
      if (shouldGenerate) {
        // Apply AI-optimized parameters
        const optimizedParams = this.aiOptimizer.getOptimizedParameters();
        const adjustedSignal = this.adjustSignalWithAI(signal, optimizedParams);
        filteredSignals.push(adjustedSignal);
      }
    }
    
    // Open new trades only during peak hours or with very high confidence
    for (const signal of filteredSignals) {
      const shouldOpenTrade = marketConditions.isPeakHours || signal.confidence >= 85;
      
      if (shouldOpenTrade && signal.confidence >= 70) {
        await this.openTrade(signal);
      } else if (signal.confidence >= 70) {
        console.log(`Signal generated for ${asset} but not opening trade (outside peak hours, confidence: ${signal.confidence}%)`);
      }
    }
    
    // Update existing trades (always do this regardless of market conditions)
    await this.updateTrades(asset);
    
    // Store analysis results
    this.lastAnalysis.set(asset, {
      timestamp: Date.now(),
      signals: filteredSignals,
      marketConditions,
      data: {
        '15m': data['15m']?.length || 0,
        '1h': data['1h']?.length || 0,
        '4h': data['4h']?.length || 0
      }
    });
  }

  adjustSignalWithAI(signal, optimizedParams) {
    const adjustedSignal = { ...signal };
    
    // Adjust confidence based on strategy weights
    const strategyWeight = optimizedParams.strategyWeights[signal.strategy] || 1.0;
    adjustedSignal.confidence = Math.min(signal.confidence * strategyWeight, 95);
    
    // Adjust stop loss and take profit based on optimized parameters
    const stopLossRange = optimizedParams.parameterRanges.stopLoss.range;
    const takeProfitRange = optimizedParams.parameterRanges.takeProfit.range;
    
    if (signal.type === 'BUY') {
      const stopLossPercent = (signal.price - signal.stopLoss) / signal.price * 100;
      const newStopLossPercent = Math.max(stopLossPercent, stopLossRange[0]);
      adjustedSignal.stopLoss = signal.price * (1 - newStopLossPercent / 100);
      
      const takeProfitPercent = (signal.takeProfit - signal.price) / signal.price * 100;
      const newTakeProfitPercent = Math.max(takeProfitPercent, takeProfitRange[0]);
      adjustedSignal.takeProfit = signal.price * (1 + newTakeProfitPercent / 100);
    } else {
      const stopLossPercent = (signal.stopLoss - signal.price) / signal.price * 100;
      const newStopLossPercent = Math.max(stopLossPercent, stopLossRange[0]);
      adjustedSignal.stopLoss = signal.price * (1 + newStopLossPercent / 100);
      
      const takeProfitPercent = (signal.price - signal.takeProfit) / signal.price * 100;
      const newTakeProfitPercent = Math.max(takeProfitPercent, takeProfitRange[0]);
      adjustedSignal.takeProfit = signal.price * (1 - newTakeProfitPercent / 100);
    }
    
    return adjustedSignal;
  }

  async openTrade(signal) {
    try {
      // Check if we already have an active trade for this asset and strategy
      const activeTrades = this.tradeTracker.getActiveTrades(signal.asset);
      const existingTrade = activeTrades.find(trade => 
        trade.strategy === signal.strategy && trade.type === signal.type
      );
      
      if (existingTrade) {
        console.log(`Skipping ${signal.asset} ${signal.strategy} signal - active trade exists`);
        return;
      }
      
      // Open the trade
      const trade = await this.tradeTracker.openTrade(signal);
      
      console.log(`Opened trade: ${trade.id} - ${signal.type} ${signal.asset} at ${signal.price}`);
      
      return trade;
    } catch (error) {
      console.error(`Error opening trade for ${signal.asset}:`, error);
    }
  }

  async updateTrades(asset) {
    try {
      const currentPrice = await this.dataProvider.getRealTimeData(asset);
      const activeTrades = this.tradeTracker.getActiveTrades(asset);
      
      for (const trade of activeTrades) {
        const updatedTrade = await this.tradeTracker.updateTrade(trade.id, currentPrice.price);
        
        if (updatedTrade && updatedTrade.status === 'CLOSED') {
          // Record outcome for AI learning
          await this.aiOptimizer.recordTradeOutcome(trade, {
            exitPrice: updatedTrade.exitPrice,
            exitTime: updatedTrade.exitTime,
            profitLoss: updatedTrade.profitLoss
          });
          
          console.log(`Trade ${trade.id} closed with ${updatedTrade.profitLoss.toFixed(2)}% P/L`);
        }
      }
    } catch (error) {
      console.error(`Error updating trades for ${asset}:`, error);
    }
  }

  async getActiveSignals(asset) {
    const activeTrades = this.tradeTracker.getActiveTrades(asset);
    const lastAnalysis = this.lastAnalysis.get(asset);
    
    return {
      activeTrades,
      recentSignals: lastAnalysis?.signals || [],
      lastUpdate: lastAnalysis?.timestamp || null,
      marketConditions: lastAnalysis?.marketConditions || {}
    };
  }

  async getAssetOverview(asset) {
    try {
      const stats = await this.dataProvider.getAssetStats(asset);
      const activeTrades = this.tradeTracker.getActiveTrades(asset);
      const tradeStats = this.tradeTracker.getTradeStatistics(asset);
      const strategyPerformance = this.tradeTracker.getStrategyPerformance(asset);
      const aiRecommendations = await this.aiOptimizer.getStrategyRecommendations(asset);
      
      return {
        asset,
        stats,
        activeTrades: activeTrades.length,
        tradeStats,
        strategyPerformance,
        aiRecommendations,
        lastAnalysis: this.lastAnalysis.get(asset)
      };
    } catch (error) {
      console.error(`Error getting overview for ${asset}:`, error);
      throw error;
    }
  }

  async getSystemStatus() {
    const status = {
      isRunning: this.isRunning,
      supportedAssets: this.supportedAssets,
      lastAnalysis: {},
      activeTrades: this.tradeTracker.getActiveTrades().length,
      aiMetrics: this.aiOptimizer.getPerformanceMetrics()
    };
    
    for (const asset of this.supportedAssets) {
      const analysis = this.lastAnalysis.get(asset);
      status.lastAnalysis[asset] = {
        timestamp: analysis?.timestamp || null,
        signalCount: analysis?.signals?.length || 0,
        marketConditions: analysis?.marketConditions || {}
      };
    }
    
    return status;
  }

  async forceCloseTrade(tradeId, exitPrice) {
    try {
      const trade = await this.tradeTracker.closeTrade(tradeId, exitPrice, 'MANUAL');
      
      if (trade) {
        // Record outcome for AI learning
        await this.aiOptimizer.recordTradeOutcome(trade, {
          exitPrice: trade.exitPrice,
          exitTime: trade.exitTime,
          profitLoss: trade.profitLoss
        });
      }
      
      return trade;
    } catch (error) {
      console.error(`Error force closing trade ${tradeId}:`, error);
      throw error;
    }
  }

  async getSignalHistory(asset, days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const history = await this.tradeTracker.getTradeHistory(asset);
    
    return history.filter(trade => trade.entryTime > cutoffTime);
  }

  async exportData(asset, format = 'json') {
    try {
      const tradeData = await this.tradeTracker.exportTradeData(format);
      const overview = await this.getAssetOverview(asset);
      
      return {
        trades: tradeData,
        overview,
        exportTime: Date.now()
      };
    } catch (error) {
      console.error(`Error exporting data for ${asset}:`, error);
      throw error;
    }
  }
}

module.exports = TradingEngine; 