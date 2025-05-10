import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class dYdXDex extends BaseDex {
  constructor(provider) {
    super(provider, 'dYdX');
    this.soloAddress = '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e'; // dYdX Solo Margin
  }

  async getPairs() {
    try {
      const solo = new ethers.Contract(
        this.soloAddress,
        [
          'function getMarketTokenAddress(uint256) view returns (address)',
          'function getNumMarkets() view returns (uint256)'
        ],
        this.provider
      );

      const numMarkets = await solo.getNumMarkets();
      const pairs = new Set();

      // Process each market
      for (let i = 0; i < numMarkets; i++) {
        try {
          const tokenAddress = await solo.getMarketTokenAddress(i);
          if (tokenAddress !== ethers.ZeroAddress) {
            // dYdX uses WETH as the base token for all markets
            pairs.add(JSON.stringify({
              token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
              token1: tokenAddress,
              marketId: i
            }));
          }
        } catch (error) {
          logger.warn(`Error processing dYdX market ${i}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching dYdX pairs:', error);
      return [];
    }
  }

  async getQuote(params) {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      const market = await this.findMarket(tokenIn, tokenOut);
      
      if (!market) {
        throw new Error('Market not found');
      }

      const solo = new ethers.Contract(
        this.soloAddress,
        [
          'function getMarketPrice(uint256) view returns (uint256)',
          'function getMarketCurrentIndex(uint256) view returns (uint256)'
        ],
        this.provider
      );

      const [price, index] = await Promise.all([
        solo.getMarketPrice(market.marketId),
        solo.getMarketCurrentIndex(market.marketId)
      ]);

      // Calculate amount out based on price and index
      const amountOut = (amountIn * price) / index;
      const priceRatio = ethers.formatUnits(amountOut, 18) / ethers.formatUnits(amountIn, 18);

      return {
        source: this.name,
        price: priceRatio.toString(),
        amountOut: amountOut.toString()
      };
    } catch (error) {
      logger.error(`Error getting dYdX quote: ${error.message}`);
      return null;
    }
  }

  async findMarket(tokenIn, tokenOut) {
    const pairs = await this.getPairs();
    return pairs.find(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    );
  }
}

export default dYdXDex; 