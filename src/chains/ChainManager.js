import { ethers } from 'ethers';
import ArbitrageService from '../core/ArbitrageService.js';

class ChainManager {
  constructor() {
    this.chains = {};
    this.arbitrageServices = {};
  }
  
  addChain(chainId, config) {
    this.chains[chainId] = {
      name: config.name,
      provider: new ethers.providers.JsonRpcProvider(config.rpcUrl),
      wallet: config.privateKey ? new ethers.Wallet(config.privateKey).connect(
        new ethers.providers.JsonRpcProvider(config.rpcUrl)
      ) : null,
      tokens: config.tokens || [],
      dexes: config.dexes || []
    };
    
    // Initialize arbitrage service for this chain
    this.arbitrageServices[chainId] = new ArbitrageService(
      this.chains[chainId].provider,
      this.chains[chainId].dexes
    );
    
    return this.chains[chainId];
  }
  
  getChain(chainId) {
    return this.chains[chainId];
  }
  
  getArbitrageService(chainId) {
    return this.arbitrageServices[chainId];
  }
  
  getAllChains() {
    return Object.keys(this.chains).map(chainId => ({
      id: chainId,
      ...this.chains[chainId]
    }));
  }
  
  async scanAllChains() {
    const results = {};
    
    for (const chainId in this.arbitrageServices) {
      try {
        const opportunities = await this.arbitrageServices[chainId].scanForOpportunities();
        results[chainId] = opportunities;
      } catch (error) {
        console.error(`Error scanning chain ${chainId}:`, error);
        results[chainId] = { error: error.message };
      }
    }
    
    return results;
  }
}

export default ChainManager; 