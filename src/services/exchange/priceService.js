/**
 * Price Service - Handles fetching and processing price data from exchanges
 */
import axios from 'axios';
import { EventEmitter } from 'events';
import config from '../../config/config.js';

class PriceService extends EventEmitter {
  constructor() {
    super();
    this.prices = new Map();
    this.lastUpdated = null;
    this.updateInterval = null;
    
    // Exchange API endpoints
    this.exchanges = {
      binance: 'https://api.binance.com/api/v3/ticker/price',
      coinbase: 'https://api.coinbase.com/v2/prices',
      kraken: 'https://api.kraken.com/0/public/Ticker',
      huobi: 'https://api.huobi.pro/market/detail/merged',
      kucoin: 'https://api.kucoin.com/api/v1/market/allTickers'
    };
    
    this.supportedPairs = new Set();
    this.priceHistory = new Map();
    this.volatilityThreshold = config.arbitrage.volatilityThreshold || 0.5; // 0.5% price movement threshold
    
    // Token management
    this.tokens = new Map();
    this.popularTokens = [
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'ETH', name: 'Ethereum' },
      { symbol: 'USDT', name: 'Tether' },
      { symbol: 'USDC', name: 'USD Coin' },
      { symbol: 'BNB', name: 'Binance Coin' },
      { symbol: 'XRP', name: 'Ripple' },
      { symbol: 'ADA', name: 'Cardano' },
      { symbol: 'DOGE', name: 'Dogecoin' }
    ];
  }

  /**
   * Initialize the price service
   */
  async initialize() {
    try {
      // Initialize popular tokens
      await this.initializeTokens();
      
      // Set up supported trading pairs
      await this.updateSupportedPairs();
      
      // Start real-time price updates
      this.startPriceUpdates();
      
      // Set up price movement monitoring
      this.startVolatilityMonitoring();
      
      console.log('Price service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing price service:', error);
      throw error;
    }
  }

  /**
   * Initialize popular tokens
   */
  async initializeTokens() {
    try {
      for (const token of this.popularTokens) {
        this.tokens.set(token.symbol, {
          ...token,
          prices: new Map(),
          lastUpdated: null
        });
      }
      console.log(`Initialized ${this.popularTokens.length} popular tokens`);
    } catch (error) {
      console.error('Error initializing tokens:', error);
      throw error;
    }
  }

  /**
   * Update list of supported trading pairs
   */
  async updateSupportedPairs() {
    try {
      // Fetch supported pairs from Binance (as reference)
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
      const pairs = response.data.symbols
        .filter(symbol => symbol.status === 'TRADING')
        .map(symbol => symbol.symbol);
      
      this.supportedPairs = new Set(pairs);
      console.log(`Updated ${pairs.length} supported trading pairs`);
    } catch (error) {
      console.error('Error updating supported pairs:', error);
      throw error;
    }
  }

  /**
   * Get token information
   */
  getToken(symbol) {
    return this.tokens.get(symbol);
  }

  /**
   * Get all tokens
   */
  getAllTokens() {
    return Array.from(this.tokens.values());
  }

  /**
   * Get token price from a specific exchange
   */
  getTokenPrice(symbol, exchange) {
    const token = this.tokens.get(symbol);
    if (!token) return null;
    return token.prices.get(exchange);
  }

  /**
   * Update token price
   */
  updateTokenPrice(symbol, exchange, price) {
    const token = this.tokens.get(symbol);
    if (!token) return;
    
    token.prices.set(exchange, price);
    token.lastUpdated = new Date();
  }

  /**
   * Start real-time price updates
   */
  startPriceUpdates() {
    // Update prices every 5 seconds
    this.updateInterval = setInterval(async () => {
      await this.updatePrices();
    }, config.arbitrage.scanIntervalMs || 5000);
  }

  /**
   * Start monitoring price volatility
   */
  startVolatilityMonitoring() {
    setInterval(() => {
      this.checkVolatility();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Check for significant price movements
   */
  checkVolatility() {
    for (const [pair, prices] of this.priceHistory.entries()) {
      if (prices.length < 2) continue;

      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices[prices.length - 2];
      const priceChange = Math.abs((currentPrice - previousPrice) / previousPrice * 100);

      if (priceChange >= this.volatilityThreshold) {
        this.emit('priceMovement', {
          pair,
          currentPrice,
          previousPrice,
          change: priceChange,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Update prices from all exchanges
   */
  async updatePrices() {
    try {
      const pricePromises = Object.entries(this.exchanges).map(([exchange, url]) =>
        this.fetchExchangePrices(exchange, url)
      );

      await Promise.all(pricePromises);
      this.lastUpdated = new Date();
      this.emit('pricesUpdated', this.prices);
    } catch (error) {
      console.error('Error updating prices:', error);
      this.emit('error', error);
    }
  }

  /**
   * Fetch prices from a specific exchange
   */
  async fetchExchangePrices(exchange, url) {
    try {
      let response;
      switch (exchange) {
        case 'binance':
          response = await axios.get(url);
          await this.processBinancePrices(response.data, exchange);
          break;
        case 'coinbase':
          response = await axios.get(url);
          await this.processCoinbasePrices(response.data, exchange);
          break;
        case 'kraken':
          response = await axios.get(url);
          await this.processKrakenPrices(response.data, exchange);
          break;
        case 'huobi':
          response = await axios.get(url);
          await this.processHuobiPrices(response.data, exchange);
          break;
        case 'kucoin':
          response = await axios.get(url);
          await this.processKucoinPrices(response.data, exchange);
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${exchange} prices:`, error);
    }
  }

  /**
   * Process prices from Binance
   */
  async processBinancePrices(data, exchange) {
    for (const ticker of data) {
      const symbol = ticker.symbol;
      const price = parseFloat(ticker.price);
      
      // Update price history
      this.updatePrice(symbol, price);
      
      // Update token prices
      for (const token of this.popularTokens) {
        if (symbol.endsWith(token.symbol)) {
          this.updateTokenPrice(token.symbol, exchange, price);
        }
      }
    }
  }

  /**
   * Process prices from Coinbase
   */
  async processCoinbasePrices(data, exchange) {
    for (const [pair, priceData] of Object.entries(data)) {
      const price = parseFloat(priceData.amount);
      
      // Update price history
      this.updatePrice(pair, price);
      
      // Update token prices
      for (const token of this.popularTokens) {
        if (pair.endsWith(token.symbol)) {
          this.updateTokenPrice(token.symbol, exchange, price);
        }
      }
    }
  }

  /**
   * Process prices from Kraken
   */
  async processKrakenPrices(data, exchange) {
    for (const [pair, ticker] of Object.entries(data.result)) {
      const price = parseFloat(ticker.c[0]);
      
      // Update price history
      this.updatePrice(pair, price);
      
      // Update token prices
      for (const token of this.popularTokens) {
        if (pair.endsWith(token.symbol)) {
          this.updateTokenPrice(token.symbol, exchange, price);
        }
      }
    }
  }

  /**
   * Process prices from Huobi
   */
  async processHuobiPrices(data, exchange) {
    for (const ticker of data.data) {
      const symbol = ticker.symbol.toUpperCase();
      const price = parseFloat(ticker.close);
      
      // Update price history
      this.updatePrice(symbol, price);
      
      // Update token prices
      for (const token of this.popularTokens) {
        if (symbol.endsWith(token.symbol)) {
          this.updateTokenPrice(token.symbol, exchange, price);
        }
      }
    }
  }

  /**
   * Process prices from KuCoin
   */
  async processKucoinPrices(data, exchange) {
    for (const ticker of data.data.ticker) {
      const symbol = ticker.symbol;
      const price = parseFloat(ticker.last);
      
      // Update price history
      this.updatePrice(symbol, price);
      
      // Update token prices
      for (const token of this.popularTokens) {
        if (symbol.endsWith(token.symbol)) {
          this.updateTokenPrice(token.symbol, exchange, price);
        }
      }
    }
  }

  /**
   * Update price for a trading pair
   */
  updatePrice(pair, price) {
    if (!this.prices.has(pair)) {
      this.prices.set(pair, []);
      this.priceHistory.set(pair, []);
    }

    const prices = this.prices.get(pair);
    const history = this.priceHistory.get(pair);

    prices.push(price);
    history.push(price);

    // Keep only last 100 price points
    if (prices.length > 100) prices.shift();
    if (history.length > 100) history.shift();
  }

  /**
   * Get current price for a trading pair
   */
  getPrice(pair) {
    const prices = this.prices.get(pair);
    return prices ? prices[prices.length - 1] : null;
  }

  /**
   * Get price history for a trading pair
   */
  getPriceHistory(pair) {
    return this.priceHistory.get(pair) || [];
  }

  /**
   * Get all current prices
   */
  getAllPrices() {
    const result = {};
    for (const [pair, prices] of this.prices.entries()) {
      result[pair] = prices[prices.length - 1];
    }
    return result;
  }

  /**
   * Stop price updates
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export default PriceService; 