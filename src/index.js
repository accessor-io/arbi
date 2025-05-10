/**
 * Entry point for the Crypto Arbitrage application
 */
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { logger } from './utils/logger.js';
import ServiceContainer from './services/ServiceContainer.js';
import ArbitrageDetector from './core/ArbitrageDetector.js';
import UniswapV2 from './exchanges/UniswapV2.js';
import SushiSwap from './exchanges/SushiSwap.js';
import PancakeSwapDex from './exchanges/PancakeSwapDex.js';
import CurveDex from './exchanges/CurveDex.js';
import BalancerDex from './exchanges/BalancerDex.js';
import dYdXDex from './exchanges/dYdXDex.js';
import OneInchDex from './exchanges/OneInchDex.js';
import RPCProvider from './services/RPCProvider.js';
import TokenManager from './services/utils/TokenManager.js';
import RouteAggregator from './services/RouteAggregator.js';
import ConfigService from './services/ConfigService.js';
import KyberSwapDex from './exchanges/KyberSwapDex.js';
import TraderJoeDex from './exchanges/TraderJoeDex.js';
import GMXDex from './exchanges/GMXDex.js';

// Load environment variables
dotenv.config();

class ArbitrageApp {
  constructor() {
    this.config = null;
    this.rpcProvider = null;
    this.tokenManager = null;
    this.routeAggregator = null;
    this.arbitrageDetector = null;
    this.scanInterval = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        logger.info('Application already initialized');
        return;
      }

      // Initialize config service
      this.config = new ConfigService();
      await this.config.load();

      // Initialize a single RPCProvider for all networks
      this.rpcProvider = new RPCProvider({
        ethereum: {
          primary: this.config.get('ETH_RPC_URL'),
          fallback: this.config.get('ETH_FALLBACK_RPC_URL'),
          timeout: 30000,
          pollingInterval: 4000
        },
        arbitrum: {
          primary: this.config.get('ARBITRUM_RPC_URL'),
          fallback: this.config.get('ARBITRUM_FALLBACK_RPC_URL'),
          timeout: 30000,
          pollingInterval: 4000
        },
        bsc: {
          primary: this.config.get('BSC_RPC_URL'),
          fallback: this.config.get('BSC_FALLBACK_RPC_URL'),
          timeout: 30000,
          pollingInterval: 4000
        }
      });
      await this.rpcProvider.initialize();

      // Initialize DEXes with ethers providers
      const dexes = [
        new UniswapV2(this.rpcProvider.getProvider('ethereum')),
        new SushiSwap(this.rpcProvider.getProvider('ethereum')),
        new PancakeSwapDex(this.rpcProvider.getProvider('bsc')),
        new CurveDex(this.rpcProvider.getProvider('ethereum')),
        new BalancerDex(this.rpcProvider.getProvider('ethereum')),
        new dYdXDex(this.rpcProvider.getProvider('ethereum')),
        new OneInchDex(this.rpcProvider.getProvider('ethereum')),
        new KyberSwapDex(this.rpcProvider.getProvider('ethereum')),
        new TraderJoeDex(this.rpcProvider.getProvider('arbitrum')),
        new GMXDex(this.rpcProvider.getProvider('arbitrum'))
      ];

      // Initialize token manager with DEXes
      this.tokenManager = new TokenManager();
      for (const dex of dexes) {
        this.tokenManager.addDex(dex);
      }

      // Fetch pairs from all DEXes
      await this.tokenManager.fetchPairs();

      // Initialize route aggregator
      this.routeAggregator = new RouteAggregator(this.rpcProvider.getProvider('ethereum'));

      // Initialize arbitrage detector
      this.arbitrageDetector = new ArbitrageDetector(
        this.routeAggregator,
        this.tokenManager
      );

      // Handle shutdown signals
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

      this.isInitialized = true;
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async start() {
    try {
      logger.info('Starting application...');
      
      // Ensure initialization is complete
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Start continuous scanning
      this.scanInterval = setInterval(async () => {
        try {
          if (!this.arbitrageDetector) {
            logger.error('Arbitrage detector not initialized');
            return;
          }

          const opportunities = await this.arbitrageDetector.findArbitrageOpportunities();
          
          if (opportunities.length > 0) {
            logger.info(`Found ${opportunities.length} arbitrage opportunities:`);
            opportunities.forEach(opp => {
              logger.info(`Profit: ${opp.profitPercentage}%`);
              logger.info(`Buy: ${opp.buyExchange} at ${opp.buyPrice}`);
              logger.info(`Sell: ${opp.sellExchange} at ${opp.sellPrice}`);
              logger.info('---');
            });
          }
        } catch (error) {
          logger.error('Error during arbitrage scan:', error);
        }
      }, 30000); // Scan every 30 seconds

      logger.info('Arbitrage detection started');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  async addTokens(tokenAddresses) {
    try {
      if (!this.tokenManager) {
        throw new Error('Token manager not initialized');
      }

      for (const address of tokenAddresses) {
        await this.tokenManager.loadToken(address);
      }
      logger.info(`Added ${tokenAddresses.length} tokens`);
    } catch (error) {
      logger.error('Error adding tokens:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
      }

      // Clean up resources
      await this.rpcProvider.destroy();

      logger.info('Application shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start the application
const app = new ArbitrageApp();
app.start().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});