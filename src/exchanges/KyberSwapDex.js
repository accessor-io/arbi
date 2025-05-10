import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class KyberSwapDex extends BaseDex {
  constructor(provider) {
    super(provider, 'KyberSwap');
    this.factoryAddress = '0x5F1dddbf348aC2fbe22a163e30F99F9ECE3DD50a'; // KyberSwap Factory
    this.routerAddress = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'; // KyberSwap Router
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.factoryAddress,
        [
          'function getPools(address) view returns (address[])',
          'function getPool(address,address,uint24) view returns (address)'
        ],
        this.provider
      );

      // Get all pools from factory
      const pools = await factory.getPools(this.routerAddress);
      const pairs = new Set();

      // Process each pool
      for (const pool of pools) {
        try {
          const poolContract = new ethers.Contract(
            pool,
            [
              'function token0() view returns (address)',
              'function token1() view returns (address)'
            ],
            this.provider
          );

          const [token0, token1] = await Promise.all([
            poolContract.token0(),
            poolContract.token1()
          ]);

          if (token0 !== ethers.ZeroAddress && token1 !== ethers.ZeroAddress) {
            pairs.add(JSON.stringify({
              token0,
              token1,
              pool
            }));
          }
        } catch (error) {
          logger.warn(`Error processing KyberSwap pool ${pool}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching KyberSwap pairs:', error);
      return [];
    }
  }

  async getQuote(params) {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      
      const router = new ethers.Contract(
        this.routerAddress,
        [
          'function getAmountsOut(uint256,address[]) view returns (uint256[])',
          'function getAmountOut(uint256,address,address) view returns (uint256)'
        ],
        this.provider
      );

      // Try direct quote first
      try {
        const amountOut = await router.getAmountOut(amountIn, tokenIn, tokenOut);
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
      logger.error(`Error getting KyberSwap quote: ${error.message}`);
      return null;
    }
  }

  async findBestPath(tokenIn, tokenOut) {
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

export default KyberSwapDex; 