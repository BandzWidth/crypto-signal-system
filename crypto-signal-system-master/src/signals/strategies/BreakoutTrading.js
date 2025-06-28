class BreakoutTrading {
  async analyze(asset, data) {
    const signals = [];
    const data1h = data['1h'];
    
    if (!data1h || data1h.length < 50) return signals;
    
    const analysis = this.analyzeTimeframe(data1h);
    const currentPrice = analysis.currentPrice;
    const resistance = analysis.resistance;
    const support = analysis.support;
    const volume = analysis.volume;
    const avgVolume = analysis.avgVolume;
    const bollingerBands = analysis.bollingerBands;
    
    const volumeSpike = volume > avgVolume * 2;
    
    // Breakout above resistance
    if (currentPrice > resistance && volumeSpike) {
      signals.push({
        asset,
        strategy: 'Breakout Trading',
        type: 'BUY',
        price: currentPrice,
        stopLoss: resistance * 0.995,
        takeProfit: currentPrice + (currentPrice - resistance),
        confidence: this.calculateConfidence(analysis, 'breakout'),
        risk: 0.04,
        timestamp: Date.now(),
        reason: 'Breakout above resistance with high volume'
      });
    }
    
    // Breakdown below support
    if (currentPrice < support && volumeSpike) {
      signals.push({
        asset,
        strategy: 'Breakout Trading',
        type: 'SELL',
        price: currentPrice,
        stopLoss: support * 1.005,
        takeProfit: currentPrice - (support - currentPrice),
        confidence: this.calculateConfidence(analysis, 'breakdown'),
        risk: 0.04,
        timestamp: Date.now(),
        reason: 'Breakdown below support with high volume'
      });
    }
    
    // Bollinger Band breakout
    if (currentPrice > bollingerBands.upper && volumeSpike) {
      signals.push({
        asset,
        strategy: 'Breakout Trading',
        type: 'BUY',
        price: currentPrice,
        stopLoss: bollingerBands.middle,
        takeProfit: currentPrice + (bollingerBands.upper - bollingerBands.middle),
        confidence: this.calculateConfidence(analysis, 'bollinger_breakout'),
        risk: 0.03,
        timestamp: Date.now(),
        reason: 'Breakout above upper Bollinger Band with high volume'
      });
    }
    
    return signals;
  }
  
  analyzeTimeframe(data) {
    const currentPrice = data[data.length - 1].close;
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    // Calculate support and resistance
    const support = Math.min(...lows.slice(-20));
    const resistance = Math.max(...highs.slice(-20));
    
    // Calculate volume metrics
    const volume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
    
    // Calculate Bollinger Bands
    const bollingerBands = this.calculateBollingerBands(closes, 20, 2);
    
    return {
      currentPrice,
      support,
      resistance,
      volume,
      avgVolume,
      bollingerBands
    };
  }
  
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0 };
    }
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    
    // Calculate standard deviation
    const variance = recentPrices.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }
  
  calculateConfidence(analysis, type) {
    let confidence = 70;
    
    // Volume spike bonus
    if (analysis.volume > analysis.avgVolume * 3) {
      confidence += 15;
    } else if (analysis.volume > analysis.avgVolume * 2) {
      confidence += 10;
    }
    
    // Breakout strength bonus
    const range = analysis.resistance - analysis.support;
    const rangePercentage = (range / analysis.currentPrice) * 100;
    
    if (type === 'breakout' || type === 'breakdown') {
      if (rangePercentage > 5) {
        confidence += 10;
      } else if (rangePercentage > 3) {
        confidence += 5;
      }
    }
    
    // Bollinger Band breakout bonus
    if (type === 'bollinger_breakout') {
      const bbRange = analysis.bollingerBands.upper - analysis.bollingerBands.lower;
      const bbRangePercentage = (bbRange / analysis.currentPrice) * 100;
      
      if (bbRangePercentage > 4) {
        confidence += 10;
      }
    }
    
    return Math.min(confidence, 95);
  }
}

module.exports = BreakoutTrading; 