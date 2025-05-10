import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

class TokenManager {
  constructor(provider) {
    this.provider = provider;
    this.tokens = new Map();
    this.pairs = new Map();
    this.dexes = [];
  }

  /**
   * Add a DEX to scan for token pairs
   * @param {Object} dex - DEX instance with getPairs method
   */
  addDex(dex) {
    if (typeof dex.getPairs === 'function') {
      this.dexes.push(dex);
      logger.info(`Added DEX ${dex.constructor.name} to TokenManager`);
    } else {
      logger.warn(`DEX ${dex.constructor.name} does not implement getPairs method`);
    }
  }

  /**
   * Fetch all token pairs from registered DEXes
   * @returns {Promise<void>}
   */
  async fetchPairs() {
    logger.info('Fetching token pairs from DEXes...');
    const pairPromises = this.dexes.map(async dex => {
      try {
        const pairs = await dex.getPairs();
        pairs.forEach(pair => {
          const pairKey = `${pair.token0}-${pair.token1}`;
          if (!this.pairs.has(pairKey)) {
            this.pairs.set(pairKey, {
              token0: pair.token0,
              token1: pair.token1,
              dex: dex.constructor.name
            });
            // Load token details if not already loaded
            this.loadToken(pair.token0).catch(() => {});
            this.loadToken(pair.token1).catch(() => {});
          }
        });
        logger.info(`Fetched ${pairs.length} pairs from ${dex.constructor.name}`);
      } catch (error) {
        logger.error(`Error fetching pairs from ${dex.constructor.name}:`, error);
      }
    });

    await Promise.all(pairPromises);
    logger.info(`Total unique pairs found: ${this.pairs.size}`);
  }

  /**
   * Get all discovered token pairs
   * @returns {Array<{base: string, quote: string}>}
   */
  getCommonPairs() {
    return Array.from(this.pairs.values()).map(pair => ({
      base: pair.token0,
      quote: pair.token1
    }));
  }

  /**
   * Load token details from the blockchain
   * @param {string} address - Token address
   * @returns {Promise<Object>} Token details
   */
  async loadToken(address) {
    if (this.tokens.has(address)) {
      return this.tokens.get(address);
    }

    try {
      const tokenContract = new ethers.Contract(
        address,
        [
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function name() view returns (string)'
        ],
        this.provider
      );

      const [symbol, decimals, name] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.name()
      ]);

      const token = {
        address,
        symbol,
        decimals,
        name
      };

      this.tokens.set(address, token);
      return token;
    } catch (error) {
      logger.error(`Error loading token ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get token details by address
   * @param {string} address - Token address
   * @returns {Object|undefined} Token details
   */
  getToken(address) {
    return this.tokens.get(address);
  }

  /**
   * Get all loaded tokens
   * @returns {Array<Object>} Array of token details
   */
  getAllTokens() {
    return Array.from(this.tokens.values());
  }
}

export default TokenManager; 