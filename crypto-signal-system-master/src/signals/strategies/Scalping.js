class Scalping {
  async analyze(asset, data) {
    const signals = [];
    const data15m = data['15m'];
    
    if (!data15m || data15m.length < 20) return signals;
    
    const analysis = this.analyzeTimeframe(data15m);
    const currentPrice = analysis.currentPrice;
    const rsi = analysis.rsi;
    const macd = analysis.macd;
    const volume = analysis.volume;
    const avgVolume = analysis.avgVolume;
    
    // Volume spike detection
    const volumeSpike = volume > avgVolume * 1.5;
    
    // RSI divergence
    const rsiOversold = rsi < 30;
    const rsiOverbought = rsi > 70;
    
    // MACD momentum
    const macdBullish = macd.MACD > macd.signal && macd.MACD > 0;
    const macdBearish = macd.MACD < macd.signal && macd.MACD < 0;
    
    // Buy signal
    if (rsiOversold && macdBullish && volumeSpike) {
      signals.push({
        asset,
        strategy: 'Scalping',
        type: 'BUY',
        price: currentPrice,
        stopLoss: currentPrice * 0.995,
        takeProfit: currentPrice * 1.01,
        confidence: this.calculateConfidence(analysis),
        risk: 0.02,
        timestamp: Date.now(),
        reason: 'Oversold RSI with bullish MACD and volume spike'
      });
    }
    
    // Sell signal
    if (rsiOverbought && macdBearish && volumeSpike) {
      signals.push({
        asset,
        strategy: 'Scalping',
        type: 'SELL',
        price: currentPrice,
        stopLoss: currentPrice * 1.005,
        takeProfit: currentPrice * 0.99,
        confidence: this.calculateConfidence(analysis),
        risk: 0.02,
        timestamp: Date.now(),
        reason: 'Overbought RSI with bearish MACD and volume spike'
      });
    }
    
    return signals;
  }
  
  analyzeTimeframe(data) {
    const currentPrice = data[data.length - 1].close;
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    // Calculate RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Calculate MACD
    const macd = this.calculateMACD(closes);
    
    // Calculate volume metrics
    const volume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
    
    return {
      currentPrice,
      rsi,
      macd,
      volume,
      avgVolume
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
  
  calculateConfidence(analysis) {
    let confidence = 65;
    
    // Volume spike bonus
    if (analysis.volume > analysis.avgVolume * 2) {
      confidence += 10;
    }
    
    // RSI extreme bonus
    if (analysis.rsi < 25 || analysis.rsi > 75) {
      confidence += 10;
    }
    
    // MACD strength bonus
    if (Math.abs(analysis.macd.MACD) > Math.abs(analysis.macd.signal)) {
      confidence += 5;
    }
    
    return Math.min(confidence, 95);
  }
}

module.exports = Scalping; 