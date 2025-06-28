class FibonacciTrading {
  async analyze(asset, data) {
    const signals = [];
    const data1h = data['1h'];
    
    if (!data1h || data1h.length < 50) return signals;
    
    const analysis = this.analyzeTimeframe(data1h);
    const currentPrice = analysis.currentPrice;
    const fibLevels = analysis.fibLevels;
    const rsi = analysis.rsi;
    const macd = analysis.macd;
    
    // Check for reversals at Fibonacci levels
    for (const [level, price] of Object.entries(fibLevels)) {
      const distance = Math.abs(currentPrice - price) / currentPrice * 100;
      
      if (distance < 0.5) { // Within 0.5% of Fibonacci level
        if (currentPrice > price && rsi < 40 && macd.MACD > macd.signal) {
          signals.push({
            asset,
            strategy: 'Fibonacci Trading',
            type: 'BUY',
            price: currentPrice,
            stopLoss: price * 0.995,
            takeProfit: currentPrice + (analysis.range * 0.382),
            confidence: this.calculateConfidence(analysis, level, 'support'),
            risk: 0.03,
            timestamp: Date.now(),
            reason: `Bounce from ${level} Fibonacci retracement level`
          });
        }
        
        if (currentPrice < price && rsi > 60 && macd.MACD < macd.signal) {
          signals.push({
            asset,
            strategy: 'Fibonacci Trading',
            type: 'SELL',
            price: currentPrice,
            stopLoss: price * 1.005,
            takeProfit: currentPrice - (analysis.range * 0.382),
            confidence: this.calculateConfidence(analysis, level, 'resistance'),
            risk: 0.03,
            timestamp: Date.now(),
            reason: `Rejection at ${level} Fibonacci retracement level`
          });
        }
      }
    }
    
    return signals;
  }
  
  analyzeTimeframe(data) {
    const currentPrice = data[data.length - 1].close;
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    
    // Find swing high and low
    const swingHigh = Math.max(...highs.slice(-20));
    const swingLow = Math.min(...lows.slice(-20));
    const range = swingHigh - swingLow;
    
    // Fibonacci levels
    const fibLevels = {
      0.236: swingHigh - (range * 0.236),
      0.382: swingHigh - (range * 0.382),
      0.618: swingHigh - (range * 0.618),
      0.786: swingHigh - (range * 0.786)
    };
    
    // Calculate RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Calculate MACD
    const macd = this.calculateMACD(closes);
    
    return {
      currentPrice,
      swingHigh,
      swingLow,
      range,
      fibLevels,
      rsi,
      macd
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
  
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
      return { MACD: 0, signal: 0, histogram: 0 };
    }
    
    const ema12 = this.calculateEMA(prices, fastPeriod);
    const ema26 = this.calculateEMA(prices, slowPeriod);
    const macdLine = ema12 - ema26;
    
    // Calculate signal line (EMA of MACD)
    const macdValues = [];
    for (let i = slowPeriod; i < prices.length; i++) {
      const ema12_i = this.calculateEMA(prices.slice(0, i + 1), fastPeriod);
      const ema26_i = this.calculateEMA(prices.slice(0, i + 1), slowPeriod);
      macdValues.push(ema12_i - ema26_i);
    }
    
    const signalLine = this.calculateEMA(macdValues, signalPeriod);
    const histogram = macdLine - signalLine;
    
    return {
      MACD: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }
  
  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  calculateConfidence(analysis, level, type) {
    let confidence = 70;
    
    // Fibonacci level importance
    const levelImportance = {
      '0.236': 5,
      '0.382': 10,
      '0.618': 15,
      '0.786': 10
    };
    
    confidence += levelImportance[level] || 0;
    
    // RSI confirmation
    if (type === 'support' && analysis.rsi < 35) {
      confidence += 10;
    } else if (type === 'resistance' && analysis.rsi > 65) {
      confidence += 10;
    }
    
    // MACD confirmation
    if (type === 'support' && analysis.macd.MACD > analysis.macd.signal) {
      confidence += 5;
    } else if (type === 'resistance' && analysis.macd.MACD < analysis.macd.signal) {
      confidence += 5;
    }
    
    // Range size bonus
    const rangePercentage = (analysis.range / analysis.currentPrice) * 100;
    if (rangePercentage > 5) {
      confidence += 5;
    }
    
    return Math.min(confidence, 95);
  }
}

module.exports = FibonacciTrading; 