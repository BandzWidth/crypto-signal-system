const ccxt = require('ccxt');
const axios = require('axios');
const moment = require('moment');
const WebSocket = require('ws');
const logger = require('../utils/logger'); // Assuming a logger utility

class DataProvider {
  constructor() {
    this.supportedAssets = ['BTC', 'ETH', 'SOL'];
    this.timeframes = ['15m', '1h', '4h', '1d'];
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache for real-time data
    
    // Real-time price data storage
    this.realTimePrices = new Map();
    this.websockets = new Map();
    
    // Multiple data sources for redundancy
    this.dataSources = [
      {
        name: 'CryptoCompare',
        baseUrl: 'https://min-api.cryptocompare.com/data',
        enabled: true
      },
      {
        name: 'CoinAPI',
        baseUrl: 'https://rest.coinapi.io/v1',
        enabled: true,
        apiKey: process.env.COINAPI_KEY || 'YOUR_COINAPI_KEY_HERE'
      }
    ];
    
    // Initialize real-time data
    this.initializeRealTimeData();
  }

  async initializeRealTimeData() {
    // Start WebSocket connections for real-time data
    this.startWebSocketConnections();
    
    // Initial data fetch from multiple sources
    await this.fetchInitialData();
  }

  startWebSocketConnections() {
    // CryptoCompare WebSocket for real-time prices
    try {
      const ws = new WebSocket('wss://streamer.cryptocompare.com/v2');
      
      ws.on('open', () => {
        logger.info('WebSocket connected to CryptoCompare');
        
        const subRequest = {
          "action": "SubAdd",
          "subs": [
            "2~Coinbase~BTC~USD",
            "2~Coinbase~ETH~USD", 
            "2~Coinbase~SOL~USD"
          ]
        };
        
        ws.send(JSON.stringify(subRequest));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', { error: error.message, data: data.toString() });
        }
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket error:', { error: error.message });
      });
      
      this.websockets.set('cryptocompare', ws);
    } catch (error) {
      logger.error('Failed to start WebSocket connection:', { error: error.message });
    }
  }

  handleWebSocketMessage(message) {
    if (message.TYPE !== '2' || !message.PRICE) return; // Only process price ticks

    const asset = this.getAssetFromSymbol(message.FROMSYMBOL);
    if (!asset) return;

    const existingData = this.realTimePrices.get(asset);
    if (!existingData) return; // Don't create new entries from WS, only update existing ones

    // ONLY update the price from the WebSocket stream.
    const updatedData = {
      ...existingData,
      price: message.PRICE,
      timestamp: Date.now()
    };

    this.realTimePrices.set(asset, updatedData);
    // logger.info(`[WS-Tick] Updated price for ${asset}: ${updatedData.price}`);
    
    this.cache.set(`realtime_${asset}`, {
        data: updatedData,
        timestamp: Date.now()
    });
  }

  getAssetFromSymbol(symbol) {
    const symbolMap = {
      'BTC': 'BTC',
      'ETH': 'ETH', 
      'SOL': 'SOL'
    };
    return symbolMap[symbol];
  }

  async fetchInitialData() {
    // Fetch initial data from multiple sources
    const promises = this.supportedAssets.map(asset => this.fetchAssetData(asset));
    await Promise.allSettled(promises);
  }

  async fetchAssetData(asset) {
    let primaryData = null;
    let secondaryData = null;

    // Prioritize CoinAPI for its reliable aggregate data
    try {
        primaryData = await this.fetchFromCoinAPI(asset);
        if (primaryData) {
            logger.info(`Successfully fetched primary data for ${asset} from CoinAPI`, { volume: primaryData.volume });
        }
    } catch (error) {
        logger.error(`Primary source CoinAPI failed for ${asset}`, { error: error.message });
    }

    // Use CryptoCompare as a secondary source if CoinAPI fails
    if (!primaryData) {
        try {
            secondaryData = await this.fetchFromCryptoCompare(asset);
            if (secondaryData) {
                logger.info(`Successfully fetched secondary data for ${asset} from CryptoCompare`, { price: secondaryData.price, volume: secondaryData.volume });
            }
        } catch (error) {
            logger.error(`Secondary source CryptoCompare failed for ${asset}`, { error: error.message });
        }
    }

    if (!primaryData && !secondaryData) {
        logger.warn(`All data sources failed for ${asset}. Generating fallback.`);
        return this.generateRealisticFallback(asset);
    }
    
    const source = primaryData ? 'CoinAPI' : 'CryptoCompare';
    const data = primaryData || secondaryData;

    // Merge data
    const mergedData = {
        symbol: asset,
        price: data.price || 0,
        volume: data.volume || 0,
        marketCap: data.marketCap || 0,
        change: data.change || 0,
        high: data.high || 0,
        low: data.low || 0,
        timestamp: Date.now()
    };
    
    this.realTimePrices.set(asset, mergedData);
    this.cache.set(`realtime_${asset}`, {
      data: mergedData,
      timestamp: Date.now()
    });

    logger.info(`Final merged data for ${asset}`, { price: mergedData.price, volume: mergedData.volume, marketCap: mergedData.marketCap, source: source });
    return mergedData;
  }

  async fetchFromCryptoCompare(asset) {
    try {
      // Get additional data
      const fullResponse = await axios.get(`${this.dataSources[0].baseUrl}/pricemultifull`, {
        params: {
          fsyms: asset,
          tsyms: 'USD'
        },
        timeout: 3000
      });

      const rawData = fullResponse.data.RAW[asset].USD;

      return {
        price: rawData.PRICE,
        volume: rawData.VOLUME24HOURTO,
        marketCap: rawData.MKTCAP,
        change: rawData.CHANGEPCT24HOUR,
        high: rawData.HIGH24HOUR,
        low: rawData.LOW24HOUR,
        source: 'CryptoCompare'
      };
    } catch (error) {
      logger.error(`Failed to fetch from CryptoCompare for ${asset}:`, { error: error.message, service: 'trading-signal-system' });
      return null;
    }
  }

  async fetchFromCoinAPI(asset) {
    const coinAPI = this.dataSources.find(ds => ds.name === 'CoinAPI');
    if (!coinAPI || !coinAPI.enabled || !coinAPI.apiKey || coinAPI.apiKey === 'YOUR_COINAPI_KEY_HERE') {
      logger.warn('CoinAPI is not configured, enabled, or no API key provided.');
      return null;
    }
  
    try {
      const response = await axios.get(`${coinAPI.baseUrl}/assets/${asset}`, {
        headers: {
          'X-CoinAPI-Key': coinAPI.apiKey
        },
        timeout: 5000
      });
  
      if (!response.data || response.data.length === 0) {
        logger.warn(`No data returned from CoinAPI for ${asset}`);
        return null;
      }
  
      const data = response.data[0];
  
      return {
        price: data.price_usd,
        volume: data.volume_1day_usd,
        marketCap: null,
        change: null,
        high: null,
        low: null,
        source: 'CoinAPI'
      };
    } catch (error)      {
      logger.error(`Failed to fetch from CoinAPI for ${asset}:`, { error: error.message, service: 'trading-signal-system' });
      return null;
    }
  }

  generateRealisticFallback(asset) {
    const prices = {
      'BTC': 65000 + Math.random() * 5000,
      'ETH': 3500 + Math.random() * 300,
      'SOL': 150 + Math.random() * 20
    };
    const price = prices[asset];
    const volumeInAsset = this.generateRealisticVolume(asset, price);
    const volumeInUSD = volumeInAsset * price;
    logger.warn(`Generating fallback data for ${asset}`);

    return {
      symbol: asset,
      price: price,
      change: (Math.random() - 0.5) * 10,
      volume: volumeInUSD,
      marketCap: price * (asset === 'BTC' ? 21e6 : (asset === 'ETH' ? 120e6 : 578e6)),
      high: price * 1.02,
      low: price * 0.98,
      timestamp: Date.now()
    };
  }

  generateRealisticVolume(asset, price) {
    const baseVolumes = {
      'BTC': 25000000000, // ~$25B daily volume
      'ETH': 15000000000, // ~$15B daily volume
      'SOL': 3000000000   // ~$3B daily volume
    };
    
    const baseVolume = baseVolumes[asset];
    const volumeVariation = 0.2; // ±20% variation
    const variation = (Math.random() - 0.5) * volumeVariation;
    
    return baseVolume * (1 + variation);
  }

  async getRealTimeData(asset) {
    // Check WebSocket data first (most real-time)
    const wsData = this.realTimePrices.get(asset);
    if (wsData && Date.now() - wsData.timestamp < 10000) { // 10 seconds
      return wsData;
    }

    // Check cache
    const cached = this.cache.get(`realtime_${asset}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Fetch fresh data
    return await this.fetchAssetData(asset);
  }

  async getOHLCV(asset, timeframe = '1h', limit = 100) {
    try {
      // Check cache first
      const cacheKey = `ohlcv_${asset}_${timeframe}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Try to get real OHLCV data from CryptoCompare
      const ohlcv = await this.fetchOHLCVFromCryptoCompare(asset, timeframe, limit);
      
      if (ohlcv && ohlcv.length > 0) {
        this.cache.set(cacheKey, {
          data: ohlcv,
          timestamp: Date.now()
        });
        return ohlcv;
      }

      // Fallback to realistic mock data
      return this.generateRealisticOHLCV(asset, timeframe, limit);
    } catch (error) {
      console.error(`Error fetching OHLCV for ${asset}:`, error);
      return this.generateRealisticOHLCV(asset, timeframe, limit);
    }
  }

  async fetchOHLCVFromCryptoCompare(asset, timeframe, limit) {
    try {
      const response = await axios.get(`${this.dataSources[0].baseUrl}/v2/histominute`, {
        params: {
          fsym: asset,
          tsym: 'USD',
          limit: limit,
          aggregate: this.getTimeframeAggregate(timeframe)
        },
        timeout: 5000
      });

      return response.data.Data.Data.map(candle => ({
        timestamp: candle.time * 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volumeto
      }));
    } catch (error) {
      console.log(`Failed to fetch OHLCV from CryptoCompare:`, error.message);
      return null;
    }
  }

  getTimeframeAggregate(timeframe) {
    const aggregates = {
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };
    return aggregates[timeframe] || 60;
  }

  generateRealisticOHLCV(asset, timeframe, limit) {
    const mockData = [];
    const currentPrice = this.realTimePrices.get(asset)?.price || this.generateRealisticFallback(asset).price;
    let price = currentPrice;
    
    for (let i = 0; i < limit; i++) {
      const volatility = 0.01; // 1% volatility
      const change = (Math.random() - 0.5) * volatility;
      price = price * (1 + change);
      
      const high = price * (1 + Math.random() * 0.005);
      const low = price * (1 - Math.random() * 0.005);
      const open = price * (1 + (Math.random() - 0.5) * 0.002);
      const close = price;
      
      mockData.push({
        timestamp: Date.now() - (limit - i) * this.timeframeToMs(timeframe),
        open,
        high,
        low,
        close,
        volume: this.generateRealisticVolume(asset, close) / 24
      });
    }
    
    return mockData;
  }

  timeframeToMs(timeframe) {
    const msMap = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return msMap[timeframe] || 60 * 60 * 1000;
  }

  async getAssetStats(asset) {
    const data = await this.getRealTimeData(asset);
    
    if (!data) {
        logger.error(`No data found for ${asset} in getAssetStats. Returning empty object.`);
        return {};
    }
    return {
      symbol: asset,
      price: data.price,
      change24h: data.change,
      volume24h: data.volume,
      marketCap: data.marketCap,
      high24h: data.high,
      low24h: data.low,
      spread: data.high && data.low && data.price ? ((data.high - data.low) / data.price) * 100 : 0
    };
  }

  async getSupportedAssets() {
    return this.supportedAssets.map(asset => ({
      symbol: asset,
      name: this.getAssetName(asset),
      description: this.getAssetDescription(asset)
    }));
  }

  getAssetName(asset) {
    const names = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana'
    };
    return names[asset] || asset;
  }

  getAssetDescription(asset) {
    const descriptions = {
      'BTC': 'The first and most well-known cryptocurrency',
      'ETH': 'Smart contract platform and cryptocurrency',
      'SOL': 'High-performance blockchain platform'
    };
    return descriptions[asset] || '';
  }

  async getMultiTimeframeData(asset) {
    const data = {};
    
    for (const timeframe of this.timeframes) {
      try {
        data[timeframe] = await this.getOHLCV(asset, timeframe, 100);
      } catch (error) {
        console.error(`Error fetching ${timeframe} data for ${asset}:`, error);
        data[timeframe] = [];
      }
    }
    
    return data;
  }

  isPeakTradingHours() {
    const now = moment();
    const edtTime = now.tz('America/New_York');
    const hour = edtTime.hour();
    
    // Peak trading hours: 8:00 AM – 4:00 PM EDT
    return hour >= 8 && hour < 16;
  }

  isLowVolatilityPeriod() {
    const now = moment();
    const utcTime = now.utc();
    const day = utcTime.day(); // 0 = Sunday, 1 = Monday
    const hour = utcTime.hour();
    
    // Monday 8–10 AM UTC (low activity)
    if (day === 1 && hour >= 8 && hour < 10) {
      return true;
    }
    
    return false;
  }

  isHighVolatilityPeriod() {
    const now = moment();
    const utcTime = now.utc();
    const day = utcTime.day();
    const hour = utcTime.hour();
    
    // Wednesday 4 PM UTC (high volatility)
    if (day === 3 && hour === 16) {
      return true;
    }
    
    return false;
  }

  async getVolumeProfile(asset, timeframe = '1h', periods = 24) {
    try {
      const ohlcv = await this.getOHLCV(asset, timeframe, periods);
      const volumes = ohlcv.map(candle => candle.volume);
      
      return {
        totalVolume: volumes.reduce((sum, vol) => sum + vol, 0),
        averageVolume: volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length,
        maxVolume: Math.max(...volumes),
        minVolume: Math.min(...volumes),
        volumeChange: ((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100
      };
    } catch (error) {
      console.error(`Error calculating volume profile for ${asset}:`, error);
      throw error;
    }
  }

  // Cleanup method
  cleanup() {
    for (const [name, ws] of this.websockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  }
}

module.exports = DataProvider; 