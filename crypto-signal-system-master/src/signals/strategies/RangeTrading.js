class RangeTrading {
  async analyze(asset, data) {
    const signals = [];
    const data1h = data['1h'];
    
    if (!data1h || data1h.length < 20) return signals;
    
    const analysis = this.analyzeTimeframe(data1h);
    const currentPrice = analysis.currentPrice;
    const support = analysis.support;
    const resistance = analysis.resistance;
    const rsi = analysis.rsi;
    
    const range = resistance - support;
    const rangePercentage = (range / currentPrice) * 100;
    
    // Only trade if range is significant (at least 2%)
    if (rangePercentage < 2) return signals;
    
    const distanceToSupport = ((currentPrice - support) / currentPrice) * 100;
    const distanceToResistance = ((resistance - currentPrice) / currentPrice) * 100;
    
    // Buy signal near support
    if (distanceToSupport < 1 && rsi < 40) {
      signals.push({
        asset,
        strategy: 'Range Trading',
        type: 'BUY',
        price: currentPrice,
        stopLoss: support * 0.995,
        takeProfit: resistance * 0.995,
        confidence: this.calculateConfidence(analysis),
        risk: 0.03,
        timestamp: Date.now(),
        reason: 'Price near support level with oversold RSI'
      });
    }
    
    // Sell signal near resistance
    if (distanceToResistance < 1 && rsi > 60) {
      signals.push({
        asset,
        strategy: 'Range Trading',
        type: 'SELL',
        price: currentPrice,
        stopLoss: resistance * 1.005,
        takeProfit: support * 1.005,
        confidence: this.calculateConfidence(analysis),
        risk: 0.03,
        timestamp: Date.now(),
        reason: 'Price near resistance level with overbought RSI'
      });
    }
    
    return signals;
  }
  
  analyzeTimeframe(data) {
    const currentPrice = data[data.length - 1].close;
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    
    // Calculate support and resistance
    const support = Math.min(...lows.slice(-10));
    const resistance = Math.max(...highs.slice(-10));
    
    // Calculate RSI
    const rsi = this.calculateRSI(closes, 14);
    
    return {
      currentPrice,
      support,
      resistance,
      rsi
    };
  }
  
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  calculateConfidence(analysis) {
    let confidence = 70;
    
    // Adjust based on RSI extremes
    if (analysis.rsi < 30 || analysis.rsi > 70) {
      confidence += 10;
    }
    
    // Adjust based on range size
    const range = analysis.resistance - analysis.support;
    const rangePercentage = (range / analysis.currentPrice) * 100;
    if (rangePercentage > 5) {
      confidence += 5;
    }
    
    return Math.min(confidence, 95);
  }
}

module.exports = RangeTrading; 