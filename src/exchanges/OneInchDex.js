import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class OneInchDex extends BaseDex {
  constructor(provider) {
    super(provider, '1inch');
    this.routerAddress = '0x1111111254EEB25477B68fb85Ed929f73A960582'; // 1inch V5 Router
    this.factoryAddress = '0x1111111254EEB25477B68fb85Ed929f73A960582'; // 1inch V5 Factory
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.factoryAddress,
        [
          'function getPools() view returns (address[])',
          'function getPoolTokens(address) view returns (address[])'
        ],
        this.provider
      );

      // Get all pools from factory
      const pools = await factory.getPools();
      const pairs = new Set();

      // Process each pool
      for (const pool of pools) {
        try {
          const tokens = await factory.getPoolTokens(pool);

          // Create pairs from the tokens in the pool
          for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
              if (tokens[i] !== ethers.ZeroAddress && tokens[j] !== ethers.ZeroAddress) {
                pairs.add(JSON.stringify({
                  token0: tokens[i],
                  token1: tokens[j],
                  pool: pool
                }));
              }
            }
          }
        } catch (error) {
          logger.warn(`Error processing 1inch pool ${pool}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching 1inch pairs:', error);
      return [];
    }
  }

  async getQuote(params) {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      
      const router = new ethers.Contract(
        this.routerAddress,
        [
          'function getAmountOut(address,address,uint256) view returns (uint256)',
          'function getAmountsOut(uint256,address[]) view returns (uint256[])'
        ],
        this.provider
      );

      // Try direct quote first
      try {
        const amountOut = await router.getAmountOut(tokenIn, tokenOut, amountIn);
        const price = ethers.formatUnits(amountOut, 18) / ethers.formatUnits(amountIn, 18);

        return {
          source: this.name,
          price: price.toString(),
          amountOut: amountOut.toString()
        };
      } catch {
        // If direct quote fails, try multi-hop route
        const path = await this.findBestPath(tokenIn, tokenOut);
        if (!path) {
          throw new Error('No route found');
        }

        const amounts = await router.getAmountsOut(amountIn, path);
        const amountOut = amounts[amounts.length - 1];
        const price = ethers.formatUnits(amountOut, 18) / ethers.formatUnits(amountIn, 18);

        return {
          source: this.name,
          price: price.toString(),
          amountOut: amountOut.toString()
        };
      }
    } catch (error) {
      logger.error(`Error getting 1inch quote: ${error.message}`);
      return null;
    }
  }

  async findBestPath(tokenIn, tokenOut) {
    // For 1inch, we'll use a simple path finding strategy
    // In a real implementation, you would want to use their API or a more sophisticated path finding algorithm
    const pairs = await this.getPairs();
    const directPair = pairs.find(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    );

    if (directPair) {
      return [tokenIn, tokenOut];
    }

    // Try to find a path through WETH
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const hasWethPair = pairs.some(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === WETH.toLowerCase()) ||
      (p.token0.toLowerCase() === WETH.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    ) && pairs.some(p => 
      (p.token0.toLowerCase() === WETH.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === WETH.toLowerCase())
    );

    if (hasWethPair) {
      return [tokenIn, WETH, tokenOut];
    }

    return null;
  }
}

export default OneInchDex; 