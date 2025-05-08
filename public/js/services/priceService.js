/**
 * Price Service for DEX Explorer
 * Handles fetching and caching of token prices from various sources
 */

class PriceService {
  constructor() {
    this.priceCache = new Map();
    this.lastFetchTime = new Map();
    this.cacheTTL = 60000; // 1 minute cache validity
  }

  /**
   * Fetch price for a token from preferred sources
   * @param {string} tokenAddress The token contract address
   * @param {string} chainId The blockchain network ID
   * @returns {Promise<number>} The token price in USD
   */
  async getTokenPrice(tokenAddress, chainId) {
    const cacheKey = `${chainId}:${tokenAddress}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`Using cached price for ${cacheKey}`);
      return this.priceCache.get(cacheKey);
    }
    
    try {
      // Try multiple sources for redundancy
      let price = await this.fetchFromPrimarySource(tokenAddress, chainId);
      
      if (!price) {
        console.log(`Fallback to secondary source for ${tokenAddress}`);
        price = await this.fetchFromSecondarySource(tokenAddress, chainId);
      }
      
      if (price) {
        this.updateCache(cacheKey, price);
        return price;
      }
      
      console.warn(`Could not fetch price for token ${tokenAddress} on chain ${chainId}`);
      return null;
    } catch (error) {
      console.error(`Error fetching price for ${tokenAddress}:`, error);
      throw error;
    }
  }
  
  isCacheValid(cacheKey) {
    if (!this.priceCache.has(cacheKey)) return false;
    
    const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
    return Date.now() - lastFetch < this.cacheTTL;
  }
  
  updateCache(cacheKey, price) {
    this.priceCache.set(cacheKey, price);
    this.lastFetchTime.set(cacheKey, Date.now());
  }
  
  async fetchFromPrimarySource(tokenAddress, chainId) {
    // For example, using CoinGecko API
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${this.getNetworkId(chainId)}?contract_addresses=${tokenAddress}&vs_currencies=usd`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      
      const data = await response.json();
      return data[tokenAddress.toLowerCase()]?.usd || null;
    } catch (error) {
      console.warn(`Primary price source failed: ${error.message}`);
      return null;
    }
  }
  
  async fetchFromSecondarySource(tokenAddress, chainId) {
    // Example: Using DEX pair data or another aggregator
    // Implementation will depend on available APIs
    // This is a placeholder
    try {
      // Simulate fetching from a DEX like Uniswap
      const url = `https://api.alternative-source.com/price?token=${tokenAddress}&chain=${chainId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      
      const data = await response.json();
      return data.price || null;
    } catch (error) {
      console.warn(`Secondary price source failed: ${error.message}`);
      return null;
    }
  }
  
  getNetworkId(chainId) {
    // Map chain IDs to CoinGecko network identifiers
    const networkMap = {
      '1': 'ethereum',
      '56': 'binance-smart-chain',
      '137': 'polygon-pos',
      // Add more as needed
    };
    
    return networkMap[chainId] || 'ethereum';
  }
}

// Singleton instance
const priceService = new PriceService();
export default priceService; 