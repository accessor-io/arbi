import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

class ConfigService {
  constructor() {
    this.config = {};
  }

  async load() {
    try {
      // Load environment variables from .env file
      dotenv.config();

      // Load configuration
      this.config = {
        // Ethereum RPC URLs
        ETH_RPC_URL: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
        ETH_FALLBACK_RPC_URL: process.env.ETH_FALLBACK_RPC_URL || 'https://rpc.ankr.com/eth',

        // Arbitrum RPC URLs
        ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        ARBITRUM_FALLBACK_RPC_URL: process.env.ARBITRUM_FALLBACK_RPC_URL || 'https://rpc.ankr.com/arbitrum',

        // BSC RPC URLs
        BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        BSC_FALLBACK_RPC_URL: process.env.BSC_FALLBACK_RPC_URL || 'https://rpc.ankr.com/bsc',

        // Other configuration
        SCAN_INTERVAL: parseInt(process.env.SCAN_INTERVAL || '30000'),
        MIN_PROFIT_PERCENTAGE: parseFloat(process.env.MIN_PROFIT_PERCENTAGE || '0.5'),
        MAX_SLIPPAGE: parseFloat(process.env.MAX_SLIPPAGE || '0.5'),
        GAS_LIMIT: parseInt(process.env.GAS_LIMIT || '300000'),
        GAS_PRICE_MULTIPLIER: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.1')
      };

      logger.info('Configuration loaded successfully');
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  get(key) {
    if (!this.config[key]) {
      logger.warn(`Configuration key not found: ${key}`);
      return null;
    }
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }
}

export default ConfigService; 