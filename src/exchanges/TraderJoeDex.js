import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class TraderJoeDex extends BaseDex {
  constructor(provider) {
    super(provider, 'TraderJoe');
    this.factoryAddress = '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10'; // TraderJoe Factory
    this.routerAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4'; // TraderJoe Router
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.factoryAddress,
        [
          'function allPairs(uint256) view returns (address)',
          'function allPairsLength() view returns (uint256)'
        ],
        this.provider
      );

      const pairsLength = await factory.allPairsLength();
      const pairs = new Set();

      // Process each pair
      for (let i = 0; i < pairsLength; i++) {
        try {
          const pairAddress = await factory.allPairs(i);
          const pairContract = new ethers.Contract(
            pairAddress,
            [
              'function token0() view returns (address)',
              'function token1() view returns (address)'
            ],
            this.provider
          );

          const [token0, token1] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);

          if (token0 !== ethers.ZeroAddress && token1 !== ethers.ZeroAddress) {
            pairs.add(JSON.stringify({
              token0,
              token1,
              pair: pairAddress
            }));
          }
        } catch (error) {
          logger.warn(`Error processing TraderJoe pair ${i}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching TraderJoe pairs:', error);
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
      logger.error(`Error getting TraderJoe quote: ${error.message}`);
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

    // Try to find a path through WAVAX
    const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
    const hasWavaxPair = pairs.some(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === WAVAX.toLowerCase()) ||
      (p.token0.toLowerCase() === WAVAX.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    ) && pairs.some(p => 
      (p.token0.toLowerCase() === WAVAX.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === WAVAX.toLowerCase())
    );

    if (hasWavaxPair) {
      return [tokenIn, WAVAX, tokenOut];
    }

    return null;
  }
}

export default TraderJoeDex; 