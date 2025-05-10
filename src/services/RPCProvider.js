import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

const RPC_ENDPOINTS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://eth-mainnet.public.blastapi.io'
];

class RPCProvider {
  constructor() {
    this.providers = RPC_ENDPOINTS.map(endpoint => 
      new ethers.providers.JsonRpcProvider(endpoint)
    );
    this.currentProviderIndex = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Base delay in ms
    this.providerStats = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.initializeProviderStats();
    this.startHealthChecks();
  }

  initializeProviderStats() {
    RPC_ENDPOINTS.forEach(endpoint => {
      this.providerStats.set(endpoint, {
        latency: [],
        failures: 0,
        lastCheck: Date.now(),
        isHealthy: true
      });
    });
  }

  startHealthChecks() {
    setInterval(() => this.checkAllProviders(), this.healthCheckInterval);
    this.checkAllProviders(); // Initial check
  }

  async checkAllProviders() {
    const checks = this.providers.map(async (provider, index) => {
      const endpoint = RPC_ENDPOINTS[index];
      const stats = this.providerStats.get(endpoint);
      
      try {
        const startTime = Date.now();
        await provider.getBlockNumber();
        const latency = Date.now() - startTime;
        
        stats.latency.push(latency);
        if (stats.latency.length > 10) stats.latency.shift(); // Keep last 10 measurements
        
        stats.isHealthy = true;
        stats.failures = 0;
        stats.lastCheck = Date.now();
        
        logger.debug(`Provider ${endpoint} health check passed. Latency: ${latency}ms`);
      } catch (error) {
        stats.failures++;
        stats.isHealthy = false;
        stats.lastCheck = Date.now();
        logger.warn(`Provider ${endpoint} health check failed: ${error.message}`);
      }
    });

    await Promise.all(checks);
    this.selectBestProvider();
  }

  selectBestProvider() {
    let bestLatency = Infinity;
    let bestIndex = this.currentProviderIndex;

    this.providerStats.forEach((stats, endpoint) => {
      if (!stats.isHealthy) return;
      
      const avgLatency = stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length;
      if (avgLatency < bestLatency) {
        bestLatency = avgLatency;
        bestIndex = RPC_ENDPOINTS.indexOf(endpoint);
      }
    });

    if (bestIndex !== this.currentProviderIndex) {
      this.currentProviderIndex = bestIndex;
      logger.info(`Switched to fastest provider: ${RPC_ENDPOINTS[bestIndex]} (${bestLatency.toFixed(2)}ms)`);
    }
  }

  getProvider() {
    return this.providers[this.currentProviderIndex];
  }

  async rotateProvider() {
    const currentStats = this.providerStats.get(RPC_ENDPOINTS[this.currentProviderIndex]);
    currentStats.isHealthy = false;
    
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
    logger.info(`Rotating to provider: ${RPC_ENDPOINTS[this.currentProviderIndex]}`);
  }

  async executeWithRetry(operation, retryCount = 0) {
    try {
      const startTime = Date.now();
      const result = await operation(this.getProvider());
      const latency = Date.now() - startTime;
      
      // Update latency stats
      const stats = this.providerStats.get(RPC_ENDPOINTS[this.currentProviderIndex]);
      stats.latency.push(latency);
      if (stats.latency.length > 10) stats.latency.shift();
      
      return result;
    } catch (error) {
      if (retryCount >= this.maxRetries) {
        throw error;
      }

      const isConnectionError = error.code === 'SERVER_ERROR' || 
                              error.code === 'NETWORK_ERROR' ||
                              error.message.includes('ECONNRESET');

      if (isConnectionError) {
        logger.warn(`RPC call failed (attempt ${retryCount + 1}/${this.maxRetries}): ${error.message}`);
        await this.rotateProvider();
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeWithRetry(operation, retryCount + 1);
      }

      throw error;
    }
  }

  async getGasPrice() {
    return this.executeWithRetry(provider => provider.getGasPrice());
  }

  async getBalance(address) {
    return this.executeWithRetry(provider => provider.getBalance(address));
  }

  async getNetwork() {
    return this.executeWithRetry(provider => provider.getNetwork());
  }

  async getBlockNumber() {
    return this.executeWithRetry(provider => provider.getBlockNumber());
  }

  async call(transaction) {
    return this.executeWithRetry(provider => provider.call(transaction));
  }

  getProviderStats() {
    return Object.fromEntries(this.providerStats);
  }
}

export default new RPCProvider(); 