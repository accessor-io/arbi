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
    this.providers = RPC_ENDPOINTS.map(endpoint => {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      provider.timeout = 30000; // 30 second timeout
      return provider;
    });
    this.currentProviderIndex = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Base delay in ms
    this.providerStats = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.requestQueue = new Map(); // Track requests per provider
    this.maxConcurrentRequests = 10; // Maximum concurrent requests per provider
    this.circuitBreaker = new Map(); // Circuit breaker state per provider
    this.requestBatches = new Map(); // Batch requests per provider
    this.batchTimeout = 100; // ms to wait for batching
    this.initializeProviderStats();
    this.startHealthChecks();
  }

  initializeProviderStats() {
    RPC_ENDPOINTS.forEach(endpoint => {
      this.providerStats.set(endpoint, {
        latency: [],
        failures: 0,
        lastCheck: Date.now(),
        isHealthy: true,
        requestCount: 0,
        lastRequestTime: Date.now(),
        errorCount: 0,
        lastErrorTime: Date.now()
      });
      this.circuitBreaker.set(endpoint, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: Date.now(),
        halfOpenTime: null
      });
      this.requestBatches.set(endpoint, []);
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
      const circuit = this.circuitBreaker.get(endpoint);
      
      try {
        const startTime = Date.now();
        await provider.getBlockNumber();
        const latency = Date.now() - startTime;
        
        stats.latency.push(latency);
        if (stats.latency.length > 10) stats.latency.shift();
        
        stats.isHealthy = true;
        stats.failures = 0;
        stats.lastCheck = Date.now();
        
        // Reset circuit breaker on successful health check
        if (circuit.isOpen) {
          circuit.isOpen = false;
          circuit.failureCount = 0;
          circuit.halfOpenTime = null;
        }
        
        logger.debug(`Provider ${endpoint} health check passed. Latency: ${latency}ms`);
      } catch (error) {
        stats.failures++;
        stats.isHealthy = false;
        stats.lastCheck = Date.now();
        stats.errorCount++;
        stats.lastErrorTime = Date.now();
        
        // Update circuit breaker
        circuit.failureCount++;
        if (circuit.failureCount >= 5) {
          circuit.isOpen = true;
          circuit.lastFailureTime = Date.now();
          circuit.halfOpenTime = Date.now() + 30000; // 30s cooldown
        }
        
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

  async waitForRateLimit(endpoint) {
    const stats = this.providerStats.get(endpoint);
    const now = Date.now();
    
    // Reset request count if more than 1 second has passed
    if (now - stats.lastRequestTime > 1000) {
      stats.requestCount = 0;
    }
    
    // If we've hit the rate limit, wait
    if (stats.requestCount >= this.maxConcurrentRequests) {
      const waitTime = 1000 - (now - stats.lastRequestTime);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        stats.requestCount = 0;
      }
    }
    
    stats.requestCount++;
    stats.lastRequestTime = now;
  }

  async executeWithRetry(operation, retryCount = 0) {
    const endpoint = RPC_ENDPOINTS[this.currentProviderIndex];
    const circuit = this.circuitBreaker.get(endpoint);
    
    // Check circuit breaker
    if (circuit.isOpen) {
      if (Date.now() >= circuit.halfOpenTime) {
        circuit.isOpen = false;
        circuit.failureCount = 0;
      } else {
        await this.rotateProvider();
        return this.executeWithRetry(operation, retryCount);
      }
    }

    try {
      await this.waitForRateLimit(endpoint);
      
      const startTime = Date.now();
      const result = await operation(this.getProvider());
      const latency = Date.now() - startTime;
      
      // Update latency stats
      const stats = this.providerStats.get(endpoint);
      stats.latency.push(latency);
      if (stats.latency.length > 10) stats.latency.shift();
      
      // Reset error count on success
      stats.errorCount = 0;
      
      return result;
    } catch (error) {
      if (retryCount >= this.maxRetries) {
        throw error;
      }

      const stats = this.providerStats.get(endpoint);
      stats.errorCount++;
      stats.lastErrorTime = Date.now();

      const isConnectionError = error.code === 'SERVER_ERROR' || 
                              error.code === 'NETWORK_ERROR' ||
                              error.message.includes('ECONNRESET') ||
                              error.code === 'TIMEOUT';

      if (isConnectionError) {
        logger.warn(`RPC call failed (attempt ${retryCount + 1}/${this.maxRetries}): ${error.message}`);
        
        // Update circuit breaker
        circuit.failureCount++;
        if (circuit.failureCount >= 5) {
          circuit.isOpen = true;
          circuit.lastFailureTime = Date.now();
          circuit.halfOpenTime = Date.now() + 30000;
        }
        
        await this.rotateProvider();
        
        // Exponential backoff with jitter
        const baseDelay = this.retryDelay * Math.pow(2, retryCount);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeWithRetry(operation, retryCount + 1);
      }

      // Handle contract-specific errors
      if (error.code === 'CALL_EXCEPTION') {
        logger.warn(`Contract call failed: ${error.message}`);
        
        // For contract calls, we might want to retry with a different provider
        // but only if it's not a revert with data
        if (!error.data || error.data === '0x') {
          await this.rotateProvider();
          return this.executeWithRetry(operation, retryCount + 1);
        }
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

export default RPCProvider; 