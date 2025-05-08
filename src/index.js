/**
 * Entry point for the Crypto Arbitrage application
 */
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { logger } from './utils/logger.js';
import ServiceContainer from './services/ServiceContainer.js';
import ArbitrageDetector from './core/ArbitrageDetector.js';
import UniswapDex from './exchanges/UniswapDex.js';
import SushiswapDex from './exchanges/SushiswapDex.js';
import PancakeSwapDex from './exchanges/PancakeSwapDex.js';
import RPCProvider from './services/RPCProvider.js';
import TokenManager from './services/TokenManager.js';
import AggregatorService from './services/AggregatorService.js';

// Load environment variables
dotenv.config();

class ArbitrageApp {
  constructor() {
    this.container = new ServiceContainer();
    this.isInitialized = false;
    this.isRunning = false;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.info('Application already initialized');
      return;
    }

    try {
      // Initialize RPC provider
      const rpcProvider = new RPCProvider({
        ethereum: {
          primary: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
          fallback: process.env.ETHEREUM_FALLBACK_RPC_URL || 'https://rpc.ankr.com/eth'
        },
        arbitrum: {
          primary: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
          fallback: process.env.ARBITRUM_FALLBACK_RPC_URL || 'https://rpc.ankr.com/arbitrum'
        }
      });
      await rpcProvider.initialize();
      this.container.services.set('rpcProvider', rpcProvider);

      // Initialize token manager
      const tokenManager = new TokenManager(rpcProvider);
      await tokenManager.initialize();
      this.container.services.set('tokenManager', tokenManager);

      // Initialize aggregator service
      const aggregatorService = new AggregatorService(rpcProvider);
      await aggregatorService.initialize();
      this.container.services.set('aggregatorService', aggregatorService);

      // Initialize DEXes
      const dexes = [
        new UniswapDex(rpcProvider),
        new SushiswapDex(rpcProvider),
        new PancakeSwapDex(rpcProvider)
      ];
      this.container.services.set('dexes', dexes);

      // Initialize arbitrage detector
      const detector = new ArbitrageDetector(
        this.container.get('aggregatorService'),
        this.container.get('tokenManager')
      );
      this.container.services.set('detector', detector);

      this.isInitialized = true;
      logger.info('Application initialized successfully');

      // Handle shutdown signals
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      logger.info('Application already running');
      return;
    }

    try {
      const detector = this.container.get('detector');
      const dexes = this.container.get('dexes');

      // Example token addresses (WETH and USDT)
      const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const amount = ethers.utils.parseEther('1.0'); // 1 ETH

      // Find arbitrage opportunities
      const opportunities = await detector.analyzeTokenPair(WETH, USDT, amount, dexes);
      
      if (opportunities) {
        logger.info('Found arbitrage opportunity:', {
          buyDex: opportunities.buyDex,
          sellDex: opportunities.sellDex,
          profit: ethers.utils.formatEther(opportunities.profit),
          profitPercentage: opportunities.profitPercentage
        });
      } else {
        logger.info('No arbitrage opportunities found');
      }

      this.isRunning = true;
      logger.info('Application started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down application...');
    try {
      await this.container.cleanup();
      this.isRunning = false;
      this.isInitialized = false;
      logger.info('Application shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      initialized: this.isInitialized,
      services: Array.from(this.container.services.keys()),
      metrics: this.container.get('monitoring')?.getMetrics() || {}
    };
  }
}

// Create and export the app instance
const app = new ArbitrageApp();
export default app;

// Start the application
app.start().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
}); 