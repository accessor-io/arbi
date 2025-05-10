import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { providers } from '../../config/network.js';
import Uniswap from '../../exchanges/Uniswap.js';
import Sushiswap from '../../exchanges/SushiSwap.js';
import TokenManager from '../utils/TokenManager.js';
import ArbitrageDetector from '../../core/ArbitrageDetector.js';
import ArbitrageExecutor from '../../core/ArbitrageExecutor.js';

class ArbitrageService extends EventEmitter {
  constructor(configService = null, aggregatorService = null) {
    super();
    this.configService = configService;
    this.provider = providers.mainnet;
    this.exchanges = [
      new Uniswap(this.provider),
      new Sushiswap(this.provider)
      // Add more exchanges as needed
    ];
    this.tokenManager = new TokenManager(this.provider);
    this.detector = new ArbitrageDetector(aggregatorService, this.tokenManager);
    this.executor = new ArbitrageExecutor(this.exchanges, this.tokenManager);
    this.isScanning = false;
    this.scanInterval = null;
    this.opportunities = [];
    this.activeOpportunities = new Map();
  }

  async initialize() {
    try {
      // Initialize components
      await this.tokenManager.initialize();
      await this.detector.initialize();
      await this.executor.initialize();

      // Load configuration if available
      if (this.configService) {
        const scanInterval = this.configService.get('arbitrage.scanInterval', 60);
        const minProfit = this.configService.get('arbitrage.minProfit', 0.1);
        const maxSlippage = this.configService.get('arbitrage.maxSlippage', 0.5);
        
        // Configure components with settings
        this.detector.setMinProfitThreshold(minProfit);
        this.detector.setMaxSlippage(maxSlippage);
      }

      logger.info('Arbitrage service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize arbitrage service:', error);
      throw error;
    }
  }

  async startScanning(intervalSeconds = 60) {
    if (this.isScanning) {
      logger.info('Already scanning for opportunities');
      return;
    }
    
    this.isScanning = true;
    logger.info('Starting arbitrage opportunity scanning...');
    
    // Run immediately once
    await this.scanForOpportunities();
    
    // Then set interval
    this.scanInterval = setInterval(async () => {
      await this.scanForOpportunities();
    }, intervalSeconds * 1000);
  }

  stopScanning() {
    if (!this.isScanning) {
      logger.info('Not currently scanning');
      return;
    }
    
    clearInterval(this.scanInterval);
    this.isScanning = false;
    logger.info('Stopped arbitrage opportunity scanning');
  }

  async scanForOpportunities() {
    try {
      logger.info('Scanning for arbitrage opportunities...');
      await this.detector.findArbitrageOpportunities();
      this.opportunities = this.detector.getOpportunities();
      
      // Process opportunities that meet criteria
      for (const opportunity of this.opportunities) {
        if (this.shouldProcessOpportunity(opportunity)) {
          await this._processOpportunity(opportunity);
        }
      }

      logger.info(`Found ${this.opportunities.length} potential opportunities`);
      this.emit('opportunitiesUpdated', this.opportunities);
      
      return this.opportunities;
    } catch (error) {
      logger.error('Error scanning for opportunities:', error);
      this.emit('error', error);
      return [];
    }
  }

  shouldProcessOpportunity(opportunity) {
    if (!this.configService) return true;
    
    const minProfit = this.configService.get('arbitrage.minProfit', 0.1);
    const maxSlippage = this.configService.get('arbitrage.maxSlippage', 0.5);
    
    return opportunity.profit > minProfit && opportunity.slippage <= maxSlippage;
  }

  async _processOpportunity(opportunity) {
    try {
      if (this.activeOpportunities.has(opportunity.id)) {
        logger.debug(`Opportunity ${opportunity.id} already being processed`);
        return;
      }

      this.activeOpportunities.set(opportunity.id, opportunity);
      
      try {
        const result = await this.executor.executeArbitrage(
          null, // No wallet needed for automatic execution
          opportunity,
          this.configService?.get('arbitrage.maxSlippage', 0.5)
        );
        
        logger.info(`Successfully executed trade for opportunity ${opportunity.id}`);
        this.emit('opportunityExecuted', { opportunity, result });
      } catch (error) {
        logger.error(`Failed to execute trade for opportunity ${opportunity.id}:`, error);
        this.emit('executionError', { opportunity, error });
      } finally {
        this.activeOpportunities.delete(opportunity.id);
      }
    } catch (error) {
      logger.error(`Failed to process opportunity ${opportunity.id}:`, error);
      this.activeOpportunities.delete(opportunity.id);
      this.emit('error', error);
    }
  }

  getOpportunities() {
    return this.opportunities;
  }

  getActiveOpportunities() {
    return Array.from(this.activeOpportunities.values());
  }

  async executeArbitrage(wallet, opportunityIndex, slippageTolerance) {
    if (opportunityIndex < 0 || opportunityIndex >= this.opportunities.length) {
      throw new Error('Invalid opportunity index');
    }
    
    const opportunity = this.opportunities[opportunityIndex];
    
    try {
      const result = await this.executor.executeArbitrage(
        wallet,
        opportunity,
        slippageTolerance
      );
      
      this.emit('arbitrageExecuted', { opportunity, result });
      
      return {
        success: true,
        result,
        opportunity
      };
    } catch (error) {
      logger.error('Error executing arbitrage:', error);
      this.emit('arbitrageError', { opportunity, error });
      
      return {
        success: false,
        error: error.message,
        opportunity
      };
    }
  }

  async cleanup() {
    this.stopScanning();
    this.activeOpportunities.clear();
    this.opportunities = [];
    logger.info('Arbitrage service cleaned up');
  }
}

export default ArbitrageService; 