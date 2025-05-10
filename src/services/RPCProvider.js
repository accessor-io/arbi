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
  }

  getProvider() {
    return this.providers[this.currentProviderIndex];
  }

  async rotateProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
    logger.info(`Rotating to provider: ${RPC_ENDPOINTS[this.currentProviderIndex]}`);
  }

  async executeWithRetry(operation, retryCount = 0) {
    try {
      return await operation(this.getProvider());
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
}

export default new RPCProvider(); 