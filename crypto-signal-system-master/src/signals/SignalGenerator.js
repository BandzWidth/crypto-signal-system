const technicalIndicators = require('technicalindicators');
const moment = require('moment');

class SignalGenerator {
  constructor() {
    this.strategies = {
      range: require('./strategies/RangeTrading'),
      scalping: require('./strategies/Scalping'),
      breakout: require('./strategies/BreakoutTrading'),
      fibonacci: require('./strategies/FibonacciTrading')
    };
    
    this.patterns = {
      doubleBottom: this.detectDoubleBottom.bind(this),
      headAndShoulders: this.detectHeadAndShoulders.bind(this),
      channel: this.detectChannel.bind(this),
      triangle: this.detectTriangle.bind(this),
      wedge: this.detectWedge.bind(this)
    };
  }

  async generateSignals(asset, data, options = {}) {
    const signals = [];
    const { conservative = false, veryConservative = false } = options;
    
    // Adjust thresholds based on market conditions
    const baseConfidenceThreshold = veryConservative ? 80 : conservative ? 75 : 70;
    const baseRiskThreshold = veryConservative ? 0.02 : conservative ? 0.03 : 0.04;
    
    console.log(`Generating signals for ${asset} with ${veryConservative ? 'very conservative' : conservative ? 'conservative' : 'aggressive'} settings`);
    
    const { '15m': data15m, '1h': data1h, '4h': data4h } = data;
    
    // Multi-timeframe analysis
    const analysis = {
      '15m': await this.analyzeTimeframe(data15m, '15m'),
      '1h': await this.analyzeTimeframe(data1h, '1h'),
      '4h': await this.analyzeTimeframe(data4h, '4h')
    };
    
    // Strategy analysis
    for (const [strategyName, strategy] of Object.entries(this.strategies)) {
      try {
        const strategySignals = await strategy.analyze(asset, data);
        
        for (const signal of strategySignals) {
          // Apply market condition adjustments
          const adjustedSignal = this.adjustSignalForMarketConditions(signal, {
            conservative,
            veryConservative,
            baseConfidenceThreshold,
            baseRiskThreshold
          });
          
          if (adjustedSignal.confidence >= baseConfidenceThreshold) {
            signals.push(adjustedSignal);
          }
        }
      } catch (error) {
        console.error(`Error generating ${strategyName} signals for ${asset}:`, error);
      }
    }
    
    // Pattern detection
    for (const [patternName, patternFn] of Object.entries(this.patterns)) {
      try {
        const patternSignals = await patternFn(asset, data, analysis);
        signals.push(...patternSignals);
      } catch (error) {
        console.error(`Error in ${patternName} pattern:`, error);
      }
    }
    
    // Sort by confidence and limit number of signals based on market conditions
    const maxSignals = veryConservative ? 2 : conservative ? 3 : 5;
    const sortedSignals = signals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSignals);
    
    console.log(`Generated ${sortedSignals.length} signals for ${asset} (max: ${maxSignals})`);
    return sortedSignals;
  }

  async analyzeTimeframe(data, timeframe) {
    if (!data || data.length < 50) return null;
    
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    
    // Calculate indicators
    const rsi = technicalIndicators.RSI.calculate({ values: closes, period: 14 });
    const macd = technicalIndicators.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    const bb = technicalIndicators.BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const sma20 = technicalIndicators.SMA.calculate({ values: closes, period: 20 });
    const sma50 = technicalIndicators.SMA.calculate({ values: closes, period: 50 });
    
    // VWAP calculation
    const vwap = this.calculateVWAP(data);
    
    return {
      timeframe,
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      bollingerBands: bb[bb.length - 1],
      sma20: sma20[sma20.length - 1],
      sma50: sma50[sma50.length - 1],
      vwap: vwap,
      currentPrice: closes[closes.length - 1],
      support: this.findSupport(lows),
      resistance: this.findResistance(highs),
      volume: volumes[volumes.length - 1],
      avgVolume: volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    };
  }

  calculateVWAP(data) {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (const candle of data) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume;
      
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }
    
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  }

  findSupport(lows, period = 20) {
    const recentLows = lows.slice(-period);
    return Math.min(...recentLows);
  }

  findResistance(highs, period = 20) {
    const recentHighs = highs.slice(-period);
    return Math.max(...recentHighs);
  }

  adjustSignalForMarketConditions(signal, options) {
    const { conservative, veryConservative, baseConfidenceThreshold, baseRiskThreshold } = options;
    
    let adjustedSignal = { ...signal };
    
    // Adjust confidence based on market conditions
    if (veryConservative) {
      adjustedSignal.confidence = Math.min(signal.confidence * 0.9, 95); // Reduce confidence by 10%
      adjustedSignal.risk = Math.min(signal.risk * 0.7, baseRiskThreshold); // Reduce risk by 30%
    } else if (conservative) {
      adjustedSignal.confidence = Math.min(signal.confidence * 0.95, 95); // Reduce confidence by 5%
      adjustedSignal.risk = Math.min(signal.risk * 0.85, baseRiskThreshold); // Reduce risk by 15%
    }
    
    // Adjust stop loss and take profit based on risk tolerance
    if (veryConservative) {
      // Tighter stops for very conservative mode
      const stopLossDistance = Math.abs(signal.price - signal.stopLoss);
      const takeProfitDistance = Math.abs(signal.takeProfit - signal.price);
      
      adjustedSignal.stopLoss = signal.type === 'BUY' 
        ? signal.price - (stopLossDistance * 0.8)
        : signal.price + (stopLossDistance * 0.8);
        
      adjustedSignal.takeProfit = signal.type === 'BUY'
        ? signal.price + (takeProfitDistance * 1.2)
        : signal.price - (takeProfitDistance * 1.2);
    }
    
    return adjustedSignal;
  }

  async detectDoubleBottom(asset, data, analysis) {
    const signals = [];
    const data1h = data['1h'];
    
    if (!data1h || data1h.length < 50) return signals;
    
    const lows = data1h.map(d => d.low);
    const closes = data1h.map(d => d.close);
    
    // Simple double bottom detection
    for (let i = 20; i < lows.length - 10; i++) {
      const currentLow = lows[i];
      const prevLow = lows[i - 10];
      
      if (Math.abs(currentLow - prevLow) / currentLow < 0.02) { // Within 2%
        const currentPrice = closes[closes.length - 1];
        
        if (currentPrice > currentLow * 1.02) { // Confirmed breakout
          signals.push({
            asset,
            strategy: 'Chart Pattern',
            pattern: 'Double Bottom',
            type: 'BUY',
            price: currentPrice,
            stopLoss: currentLow * 0.995,
            takeProfit: currentPrice + (currentPrice - currentLow),
            confidence: this.calculateConfidence(analysis, 'pattern'),
            timestamp: Date.now(),
            reason: 'Double bottom pattern confirmed'
          });
        }
      }
    }
    
    return signals;
  }

  async detectHeadAndShoulders(asset, data, analysis) {
    // Simplified head and shoulders detection
    return [];
  }

  async detectChannel(asset, data, analysis) {
    // Simplified channel detection
    return [];
  }

  async detectTriangle(asset, data, analysis) {
    // Simplified triangle detection
    return [];
  }

  async detectWedge(asset, data, analysis) {
    // Simplified wedge detection
    return [];
  }

  calculateConfidence(analysis, strategy) {
    let confidence = 50; // Base confidence
    
    // Multi-timeframe confluence
    const timeframes = Object.keys(analysis);
    let confluenceCount = 0;
    
    for (const timeframe of timeframes) {
      if (analysis[timeframe]) {
        const rsi = analysis[timeframe].rsi;
        const macd = analysis[timeframe].macd;
        
        if (rsi && macd) {
          if ((rsi < 40 && macd.MACD > macd.signal) || 
              (rsi > 60 && macd.MACD < macd.signal)) {
            confluenceCount++;
          }
        }
      }
    }
    
    confidence += confluenceCount * 15;
    
    // Volume confirmation
    if (analysis['1h'] && analysis['1h'].volume > analysis['1h'].avgVolume * 1.5) {
      confidence += 10;
    }
    
    // Strategy-specific adjustments
    switch (strategy) {
      case 'range':
        confidence += 5;
        break;
      case 'breakout':
        confidence += 10;
        break;
      case 'scalping':
        confidence -= 5;
        break;
      case 'fibonacci':
        confidence += 5;
        break;
      case 'pattern':
        confidence += 15;
        break;
    }
    
    return Math.min(confidence, 95); // Cap at 95%
  }
}

module.exports = SignalGenerator; 