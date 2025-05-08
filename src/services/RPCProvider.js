import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

class RPCProvider {
  constructor(config = {}) {
    this.config = {
      ethereum: {
        primary: 'https://eth.llamarpc.com',
        fallback: 'https://rpc.ankr.com/eth',
        timeout: 30000,
        pollingInterval: 4000
      },
      arbitrum: {
        primary: 'https://arb1.arbitrum.io/rpc',
        fallback: 'https://rpc.ankr.com/arbitrum',
        timeout: 30000,
        pollingInterval: 4000
      },
      ...config
    };

    this.providers = new Map();
    this.activeProviders = new Map();
    this.healthChecks = new Map();
  }

  async initialize() {
    try {
      // Initialize Ethereum provider
      await this.initializeProvider('ethereum');
      
      // Initialize Arbitrum provider
      await this.initializeProvider('arbitrum');
      
      logger.info('RPC providers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RPC providers:', error);
      throw error;
    }
  }

  async initializeProvider(network) {
    const networkConfig = this.config[network];
    if (!networkConfig) {
      throw new Error(`No configuration found for network: ${network}`);
    }

    try {
      // Initialize primary provider
      const primaryProvider = new ethers.providers.JsonRpcProvider(networkConfig.primary);
      primaryProvider.timeout = networkConfig.timeout;
      primaryProvider.pollingInterval = networkConfig.pollingInterval;

      // Initialize fallback provider
      const fallbackProvider = new ethers.providers.JsonRpcProvider(networkConfig.fallback);
      fallbackProvider.timeout = networkConfig.timeout;
      fallbackProvider.pollingInterval = networkConfig.pollingInterval;

      // Store providers
      this.providers.set(network, {
        primary: primaryProvider,
        fallback: fallbackProvider
      });

      // Set primary as active initially
      this.activeProviders.set(network, primaryProvider);

      // Start health check
      this.startHealthCheck(network);

      logger.info(`Initialized ${network} provider with primary: ${networkConfig.primary}`);
    } catch (error) {
      logger.error(`Failed to initialize ${network} provider:`, error);
      throw error;
    }
  }

  async startHealthCheck(network) {
    const checkHealth = async () => {
      try {
        const provider = this.activeProviders.get(network);
        if (!provider) return;

        const blockNumber = await provider.getBlockNumber();
        if (blockNumber) {
          this.healthChecks.set(network, {
            lastCheck: Date.now(),
            isHealthy: true,
            blockNumber
          });
        }
      } catch (error) {
        logger.warn(`${network} provider health check failed:`, error.message);
        this.healthChecks.set(network, {
          lastCheck: Date.now(),
          isHealthy: false,
          error: error.message
        });

        // Try to switch to fallback provider
        await this.switchProvider(network);
      }
    };

    // Run health check every 30 seconds
    setInterval(checkHealth, 30000);
    await checkHealth(); // Initial check
  }

  async switchProvider(network) {
    const providers = this.providers.get(network);
    if (!providers) return;

    const currentProvider = this.activeProviders.get(network);
    const newProvider = currentProvider === providers.primary ? providers.fallback : providers.primary;

    try {
      // Test the new provider
      await newProvider.getBlockNumber();
      
      // Switch to new provider
      this.activeProviders.set(network, newProvider);
      logger.info(`Switched ${network} provider to: ${newProvider.connection.url}`);
    } catch (error) {
      logger.error(`Failed to switch ${network} provider:`, error);
    }
  }

  getProvider(network = 'ethereum') {
    const provider = this.activeProviders.get(network);
    if (!provider) {
      throw new Error(`No provider available for network: ${network}`);
    }
    return provider;
  }

  async getGasPrice(network = 'ethereum') {
    const provider = this.getProvider(network);
    try {
      return await provider.getGasPrice();
    } catch (error) {
      logger.error(`Failed to get gas price for ${network}:`, error);
      throw error;
    }
  }

  async getBalance(address, network = 'ethereum') {
    const provider = this.getProvider(network);
    try {
      return await provider.getBalance(address);
    } catch (error) {
      logger.error(`Failed to get balance for ${address} on ${network}:`, error);
      throw error;
    }
  }

  cleanup() {
    // Clear all intervals and providers
    this.providers.clear();
    this.activeProviders.clear();
    this.healthChecks.clear();
  }
}

export default RPCProvider; 