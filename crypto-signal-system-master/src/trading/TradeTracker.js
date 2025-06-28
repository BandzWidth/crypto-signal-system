const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

class TradeTracker {
  constructor() {
    this.activeTrades = new Map();
    this.tradeHistory = new Map();
    this.dataDir = path.join(__dirname, '../../data');
    this.tradesFile = path.join(this.dataDir, 'trades.json');
    this.historyFile = path.join(this.dataDir, 'trade_history.json');
    
    this.ensureDataDirectory();
    this.loadTrades();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async loadTrades() {
    try {
      // Load active trades
      const tradesData = await fs.readFile(this.tradesFile, 'utf8');
      const trades = JSON.parse(tradesData);
      this.activeTrades = new Map(Object.entries(trades));
    } catch (error) {
      console.log('No existing trades data found, starting fresh');
      this.activeTrades = new Map();
    }

    try {
      // Load trade history
      const historyData = await fs.readFile(this.historyFile, 'utf8');
      const history = JSON.parse(historyData);
      this.tradeHistory = new Map(Object.entries(history));
    } catch (error) {
      console.log('No existing trade history found, starting fresh');
      this.tradeHistory = new Map();
    }
  }

  async saveTrades() {
    try {
      const tradesData = Object.fromEntries(this.activeTrades);
      await fs.writeFile(this.tradesFile, JSON.stringify(tradesData, null, 2));
    } catch (error) {
      console.error('Error saving trades:', error);
    }
  }

  async saveHistory() {
    try {
      const historyData = Object.fromEntries(this.tradeHistory);
      await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.error('Error saving trade history:', error);
    }
  }

  async openTrade(signal) {
    const tradeId = `${signal.asset}_${signal.strategy}_${signal.timestamp}`;
    
    const trade = {
      id: tradeId,
      asset: signal.asset,
      strategy: signal.strategy,
      type: signal.type,
      entryPrice: signal.price,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      entryTime: signal.timestamp,
      status: 'OPEN',
      confidence: signal.confidence,
      reason: signal.reason,
      pattern: signal.pattern || null,
      lastUpdate: Date.now()
    };
    
    this.activeTrades.set(tradeId, trade);
    await this.saveTrades();
    
    console.log(`Opened trade: ${tradeId} - ${signal.type} ${signal.asset} at ${signal.price}`);
    
    return trade;
  }

  async closeTrade(tradeId, exitPrice, exitReason = 'MANUAL') {
    const trade = this.activeTrades.get(tradeId);
    
    if (!trade) {
      throw new Error(`Trade ${tradeId} not found`);
    }
    
    // Calculate profit/loss
    let profitLoss = 0;
    let exitType = '';
    
    if (trade.type === 'BUY') {
      profitLoss = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
      exitType = exitPrice >= trade.takeProfit ? 'TAKE_PROFIT' : 
                 exitPrice <= trade.stopLoss ? 'STOP_LOSS' : exitReason;
    } else {
      profitLoss = ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
      exitType = exitPrice <= trade.takeProfit ? 'TAKE_PROFIT' : 
                 exitPrice >= trade.stopLoss ? 'STOP_LOSS' : exitReason;
    }
    
    // Create trade outcome
    const outcome = {
      exitPrice,
      exitTime: Date.now(),
      exitReason: exitType,
      profitLoss,
      duration: Date.now() - trade.entryTime,
      success: profitLoss > 0
    };
    
    // Move to history
    const completedTrade = {
      ...trade,
      ...outcome,
      status: 'CLOSED'
    };
    
    this.tradeHistory.set(tradeId, completedTrade);
    this.activeTrades.delete(tradeId);
    
    await this.saveTrades();
    await this.saveHistory();
    
    console.log(`Closed trade: ${tradeId} - P/L: ${profitLoss.toFixed(2)}% - ${exitType}`);
    
    return completedTrade;
  }

  async updateTrade(tradeId, currentPrice) {
    const trade = this.activeTrades.get(tradeId);
    
    if (!trade) {
      return null;
    }
    
    // Check if stop loss or take profit hit
    let shouldClose = false;
    let exitReason = '';
    
    if (trade.type === 'BUY') {
      if (currentPrice <= trade.stopLoss) {
        shouldClose = true;
        exitReason = 'STOP_LOSS';
      } else if (currentPrice >= trade.takeProfit) {
        shouldClose = true;
        exitReason = 'TAKE_PROFIT';
      }
    } else {
      if (currentPrice >= trade.stopLoss) {
        shouldClose = true;
        exitReason = 'STOP_LOSS';
      } else if (currentPrice <= trade.takeProfit) {
        shouldClose = true;
        exitReason = 'TAKE_PROFIT';
      }
    }
    
    if (shouldClose) {
      return await this.closeTrade(tradeId, currentPrice, exitReason);
    }
    
    // Update last update time
    trade.lastUpdate = Date.now();
    await this.saveTrades();
    
    return trade;
  }

  getActiveTrades(asset = null) {
    if (asset) {
      const assetTrades = [];
      for (const [id, trade] of this.activeTrades) {
        if (trade.asset === asset) {
          assetTrades.push(trade);
        }
      }
      return assetTrades;
    }
    
    return Array.from(this.activeTrades.values());
  }

  async getTradeHistory(asset = null, limit = 100) {
    let history = Array.from(this.tradeHistory.values());
    
    if (asset) {
      history = history.filter(trade => trade.asset === asset);
    }
    
    // Sort by exit time (most recent first)
    history.sort((a, b) => b.exitTime - a.exitTime);
    
    // Limit results
    return history.slice(0, limit);
  }

  getTradeStatistics(asset = null) {
    let trades = Array.from(this.tradeHistory.values());
    
    if (asset) {
      trades = trades.filter(trade => trade.asset === asset);
    }
    
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        successfulTrades: 0,
        winRate: 0,
        totalProfitLoss: 0,
        averageProfitLoss: 0,
        bestTrade: null,
        worstTrade: null,
        averageDuration: 0
      };
    }
    
    const successfulTrades = trades.filter(trade => trade.success);
    const totalProfitLoss = trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
    const averageProfitLoss = totalProfitLoss / trades.length;
    const averageDuration = trades.reduce((sum, trade) => sum + trade.duration, 0) / trades.length;
    
    const bestTrade = trades.reduce((best, trade) => 
      trade.profitLoss > best.profitLoss ? trade : best, trades[0]);
    
    const worstTrade = trades.reduce((worst, trade) => 
      trade.profitLoss < worst.profitLoss ? trade : worst, trades[0]);
    
    return {
      totalTrades: trades.length,
      successfulTrades: successfulTrades.length,
      winRate: (successfulTrades.length / trades.length) * 100,
      totalProfitLoss,
      averageProfitLoss,
      bestTrade,
      worstTrade,
      averageDuration
    };
  }

  getStrategyPerformance(asset = null) {
    let trades = Array.from(this.tradeHistory.values());
    
    if (asset) {
      trades = trades.filter(trade => trade.asset === asset);
    }
    
    const strategyStats = {};
    
    for (const trade of trades) {
      const strategy = trade.strategy;
      
      if (!strategyStats[strategy]) {
        strategyStats[strategy] = {
          totalTrades: 0,
          successfulTrades: 0,
          totalProfitLoss: 0,
          averageProfitLoss: 0,
          winRate: 0
        };
      }
      
      strategyStats[strategy].totalTrades++;
      strategyStats[strategy].totalProfitLoss += trade.profitLoss;
      
      if (trade.success) {
        strategyStats[strategy].successfulTrades++;
      }
    }
    
    // Calculate averages and win rates
    for (const strategy in strategyStats) {
      const stats = strategyStats[strategy];
      stats.averageProfitLoss = stats.totalProfitLoss / stats.totalTrades;
      stats.winRate = (stats.successfulTrades / stats.totalTrades) * 100;
    }
    
    return strategyStats;
  }

  async getRecentPerformance(days = 30) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentTrades = Array.from(this.tradeHistory.values())
      .filter(trade => trade.exitTime > cutoffTime);
    
    return this.getTradeStatistics(null, recentTrades);
  }

  async cleanupOldTrades(maxAge = 90) {
    const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [id, trade] of this.tradeHistory) {
      if (trade.exitTime < cutoffTime) {
        this.tradeHistory.delete(id);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      await this.saveHistory();
      console.log(`Cleaned up ${cleanedCount} old trades`);
    }
  }

  getTradeById(tradeId) {
    return this.activeTrades.get(tradeId) || this.tradeHistory.get(tradeId);
  }

  async exportTradeData(format = 'json') {
    const allTrades = Array.from(this.tradeHistory.values());
    
    if (format === 'csv') {
      // Convert to CSV format
      const headers = ['id', 'asset', 'strategy', 'type', 'entryPrice', 'exitPrice', 'profitLoss', 'entryTime', 'exitTime', 'duration', 'success'];
      const csvData = [headers.join(',')];
      
      for (const trade of allTrades) {
        const row = [
          trade.id,
          trade.asset,
          trade.strategy,
          trade.type,
          trade.entryPrice,
          trade.exitPrice,
          trade.profitLoss,
          new Date(trade.entryTime).toISOString(),
          new Date(trade.exitTime).toISOString(),
          trade.duration,
          trade.success
        ];
        csvData.push(row.join(','));
      }
      
      return csvData.join('\n');
    }
    
    return allTrades;
  }
}

module.exports = TradeTracker; 