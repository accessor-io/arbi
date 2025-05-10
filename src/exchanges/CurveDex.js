import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class CurveDex extends BaseDex {
  constructor(provider) {
    super(provider, 'Curve');
    this.factoryAddress = '0xB9fC157394Af804a3578134A6580C0CE0a0C5b5F'; // Curve Factory
    this.registryAddress = '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5'; // Curve Registry
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.factoryAddress,
        [
          'function get_n_coins(address) view returns (uint256)',
          'function get_coins(address) view returns (address[8])'
        ],
        this.provider
      );

      const registry = new ethers.Contract(
        this.registryAddress,
        [
          'function get_pool_list() view returns (address[])',
          'function get_pool_from_lp_token(address) view returns (address)'
        ],
        this.provider
      );

      // Get all pools from registry
      const pools = await registry.get_pool_list();
      const pairs = new Set();

      // Process each pool
      for (const pool of pools) {
        try {
          const nCoins = await factory.get_n_coins(pool);
          const coins = await factory.get_coins(pool);

          // Create pairs from the coins in the pool
          for (let i = 0; i < nCoins; i++) {
            for (let j = i + 1; j < nCoins; j++) {
              if (coins[i] !== ethers.ZeroAddress && coins[j] !== ethers.ZeroAddress) {
                pairs.add(JSON.stringify({
                  token0: coins[i],
                  token1: coins[j],
                  pool: pool
                }));
              }
            }
          }
        } catch (error) {
          logger.warn(`Error processing Curve pool ${pool}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching Curve pairs:', error);
      return [];
    }
  }

  async getQuote(params) {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      const pool = await this.findPool(tokenIn, tokenOut);
      
      if (!pool) {
        throw new Error('Pool not found');
      }

      const poolContract = new ethers.Contract(
        pool,
        [
          'function get_dy(int128, int128, uint256) view returns (uint256)',
          'function coins(int128) view returns (address)'
        ],
        this.provider
      );

      // Find token indices
      const tokenInIndex = await this.getTokenIndex(poolContract, tokenIn);
      const tokenOutIndex = await this.getTokenIndex(poolContract, tokenOut);

      if (tokenInIndex === -1 || tokenOutIndex === -1) {
        throw new Error('Token not found in pool');
      }

      const amountOut = await poolContract.get_dy(tokenInIndex, tokenOutIndex, amountIn);
      const price = ethers.formatUnits(amountOut, 18) / ethers.formatUnits(amountIn, 18);

      return {
        source: this.name,
        price: price.toString(),
        amountOut: amountOut.toString()
      };
    } catch (error) {
      logger.error(`Error getting Curve quote: ${error.message}`);
      return null;
    }
  }

  async findPool(tokenIn, tokenOut) {
    const pairs = await this.getPairs();
    const pair = pairs.find(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    );
    return pair ? pair.pool : null;
  }

  async getTokenIndex(poolContract, token) {
    for (let i = 0; i < 8; i++) {
      try {
        const coin = await poolContract.coins(i);
        if (coin.toLowerCase() === token.toLowerCase()) {
          return i;
        }
      } catch {
        break;
      }
    }
    return -1;
  }
}

export default CurveDex; 