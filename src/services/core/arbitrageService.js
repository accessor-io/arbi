/**
 * Arbitrage Service - Detects real-time arbitrage opportunities between exchanges
 */
import { EventEmitter } from 'events';
import config from '../../config/config.js';

class ArbitrageService extends EventEmitter {
  constructor(priceService) {
    super();
    this.priceService = priceService;
    this.opportunities = [];
    this.isScanning = false;
    this.scanInterval = null;
    this.exchangeRates = new Map();
    this.callbacks = {
      onOpportunityFound: [],
      onScanComplete: [],
      onError: []
    };
    
    // Load settings from config
    this.settings = {
      minProfitThreshold: config.arbitrage.minProfitThreshold,
      maxGasPrice: config.arbitrage.maxGasPrice,
      scanIntervalMs: config.arbitrage.scanIntervalMs,
      minVolumeThreshold: config.arbitrage.minVolumeThreshold,
      maxSlippage: config.arbitrage.maxSlippage,
      minLiquidityThreshold: config.arbitrage.minLiquidityThreshold,
      maxExecutionTime: config.arbitrage.maxExecutionTime,
      supportedPairs: new Set(config.arbitrage.supportedPairs)
    };
    
    this.opportunityHistory = new Map();
    this.lastExecutionTimes = new Map();
  }

  /**
   * Initialize the arbitrage service
   */
  async initialize() {
    // Subscribe to price updates
    this.priceService.on('pricesUpdated', this.handlePriceUpdate.bind(this));
    this.priceService.on('priceMovement', this.handlePriceMovement.bind(this));
    
    // Get supported pairs
    this.settings.supportedPairs = this.priceService.supportedPairs;
    
    console.log('Arbitrage service initialized');
    return true;
  }

  /**
   * Handle price updates from exchanges
   */
  handlePriceUpdate(prices) {
    this.exchangeRates = prices;
    
    // Get all tokens from price service
    const tokens = this.priceService.getAllTokens();
    
    // Update exchange rates for each token
    for (const token of tokens) {
      const tokenPrices = new Map();
      for (const exchange of Object.keys(config.exchanges)) {
        const price = this.priceService.getTokenPrice(token.symbol, exchange);
        if (price) {
          tokenPrices.set(exchange, price);
        }
      }
      this.exchangeRates.set(token.symbol, tokenPrices);
    }
    
    if (this.isScanning) {
      this.scan();
    }
  }

  /**
   * Handle significant price movements
   */
  handlePriceMovement(data) {
    // Trigger immediate scan for the affected pair
    if (this.isScanning) {
      this.scanForPair(data.pair);
    }
  }

  /**
   * Start automated opportunity scanning
   */
  startAutomaticScanning() {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.scan(); // Initial scan
    
    // Set up interval for continuous scanning
    this.scanInterval = setInterval(() => {
      this.scan();
    }, this.settings.scanIntervalMs);
    
    console.log('Automatic scanning started');
    return true;
  }
  
  /**
   * Stop automated scanning
   */
  stopAutomaticScanning() {
    if (!this.isScanning) return;
    
    clearInterval(this.scanInterval);
    this.scanInterval = null;
    this.isScanning = false;
    
    console.log('Automatic scanning stopped');
    return true;
  }
  
  /**
   * Perform a single scan for arbitrage opportunities
   */
  async scan() {
    try {
      console.log('Scanning for arbitrage opportunities...');
      
      const opportunities = [];
      const pairs = Array.from(this.settings.supportedPairs);
      
      // Scan each pair in parallel
      const scanPromises = pairs.map(pair => this.scanForPair(pair));
      const results = await Promise.all(scanPromises);
      
      // Flatten results
      opportunities.push(...results.flat());
      
      // Filter and sort opportunities
      const viableOpportunities = this.filterOpportunities(opportunities);
      
      // Update opportunities list
      this.opportunities = viableOpportunities;
      
      // Notify listeners
      this.notifyListeners('onScanComplete', this.opportunities);
      
      // Check for high-profit opportunities
      const highProfitOpps = viableOpportunities.filter(
        opp => opp.adjustedProfitPercent >= 2.0 // 2% or higher
      );
      
      if (highProfitOpps.length > 0) {
        this.notifyListeners('onOpportunityFound', highProfitOpps);
      }
      
      return this.opportunities;
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      this.notifyListeners('onError', error);
      return [];
    }
  }

  /**
   * Scan for arbitrage opportunities for a specific pair
   */
  async scanForPair(pair) {
    const opportunities = [];
    const exchanges = Object.keys(config.exchanges);
    
    // Get token prices for the pair
    const [baseToken, quoteToken] = pair.split('/');
    const basePrices = this.exchangeRates.get(baseToken);
    const quotePrices = this.exchangeRates.get(quoteToken);
    
    if (!basePrices || !quotePrices) {
      console.log(`Missing price data for pair ${pair}`);
      return opportunities;
    }
    
    // Try to find 2-step arbitrages
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;
        
        const sourceExchange = exchanges[i];
        const destExchange = exchanges[j];
        
        // Get rates
        const buyRate = basePrices.get(sourceExchange);
        const sellRate = basePrices.get(destExchange);
        
        if (!buyRate || !sellRate) continue;
        
        // Calculate potential profit
        const investmentAmount = 1000; // Assume $1000 investment
        const boughtAmount = investmentAmount / buyRate;
        const soldAmount = boughtAmount * sellRate;
        const profit = soldAmount - investmentAmount;
        const profitPercent = (profit / investmentAmount) * 100;
        
        // Check if opportunity is viable
        if (profitPercent > 0) {
          // Estimate execution time
          const executionTime = await this.estimateExecutionTime(sourceExchange, destExchange, pair);
          
          // Check if execution time is within limits
          if (executionTime > this.settings.maxExecutionTime) continue;
          
          // Get current gas price
          const gasPrice = await this.getCurrentGasPrice();
          
          // Only include if gas price is within limits
          if (gasPrice > this.settings.maxGasPrice) continue;
          
          // Calculate gas cost
          const gasLimit = 150000;
          const gasCost = (gasPrice * gasLimit) / 1e9; // Convert to ETH
          
          // Adjust profit for gas cost
          const adjustedProfit = profit - (gasCost * sellRate);
          const adjustedProfitPercent = (adjustedProfit / investmentAmount) * 100;
          
          // Only include if adjusted profit meets threshold
          if (adjustedProfitPercent < this.settings.minProfitThreshold) continue;
          
          // Create opportunity object
          const opportunity = {
            id: `ARB-${Date.now()}-${i}-${j}`,
            path: `${sourceExchange} → ${destExchange}`,
            sourceExchange,
            destExchange,
            pair,
            baseToken,
            quoteToken,
            buyRate,
            sellRate,
            investmentAmount,
            expectedReturn: soldAmount,
            profit,
            profitPercent: parseFloat(profitPercent.toFixed(2)),
            adjustedProfit,
            adjustedProfitPercent: parseFloat(adjustedProfitPercent.toFixed(2)),
            gasPrice,
            gasCost,
            executionTime,
            timestamp: new Date(),
            route: [
              { exchange: sourceExchange, action: 'buy', asset: baseToken, price: buyRate },
              { exchange: destExchange, action: 'sell', asset: baseToken, price: sellRate }
            ]
          };
          
          opportunities.push(opportunity);
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Filter opportunities based on various criteria
   */
  filterOpportunities(opportunities) {
    return opportunities
      .filter(opp => {
        // Check minimum profit threshold
        if (opp.adjustedProfitPercent < this.settings.minProfitThreshold) return false;
        
        // Check gas price
        if (opp.gasPrice > this.settings.maxGasPrice) return false;
        
        // Check execution time
        if (opp.executionTime > this.settings.maxExecutionTime) return false;
        
        // Check if opportunity is too old
        const age = Date.now() - opp.timestamp;
        if (age > 30000) return false; // 30 seconds max age
        
        return true;
      })
      .sort((a, b) => b.adjustedProfitPercent - a.adjustedProfitPercent);
  }

  /**
   * Estimate execution time for an arbitrage
   */
  async estimateExecutionTime(sourceExchange, destExchange, pair) {
    const key = `${sourceExchange}-${destExchange}-${pair}`;
    const lastExecution = this.lastExecutionTimes.get(key);
    
    if (lastExecution) {
      return lastExecution;
    }
    
    // Simulate execution time based on exchange APIs
    const baseTime = 5000; // 5 seconds base time
    const exchangeLatency = {
      binance: 100,
      coinbase: 200,
      kraken: 300,
      huobi: 250,
      kucoin: 150
    };
    
    const totalTime = baseTime + 
      (exchangeLatency[sourceExchange] || 200) + 
      (exchangeLatency[destExchange] || 200);
    
    this.lastExecutionTimes.set(key, totalTime);
    return totalTime;
  }

  /**
   * Get current gas price
   */
  async getCurrentGasPrice() {
    try {
      const response = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=YOUR_API_KEY');
      const data = await response.json();
      return parseInt(data.result.SafeGasPrice);
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return 50; // Default to 50 Gwei if API fails
    }
  }
  
  /**
   * Get all current opportunities
   */
  getOpportunities() {
    return [...this.opportunities];
  }
  
  /**
   * Update service settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // If scan interval changed and auto-scanning is active, restart it
    if (newSettings.scanIntervalMs && this.isScanning) {
      this.stopAutomaticScanning();
      this.startAutomaticScanning();
    }
  }

  /**
   * Subscribe to service events
   */
  subscribe(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * Unsubscribe from service events
   */
  unsubscribe(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }
}

export default ArbitrageService; 