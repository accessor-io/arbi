import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class BalancerDex extends BaseDex {
  constructor(provider) {
    super(provider, 'Balancer');
    this.vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'; // Balancer V2 Vault
    this.factoryAddress = '0x67d27634E44793fE63c467035E31ea8635117cd4'; // Balancer V2 Factory
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.factoryAddress,
        [
          'function getPools(uint256) view returns (bytes32[])',
          'function getPool(bytes32) view returns (address)'
        ],
        this.provider
      );

      const vault = new ethers.Contract(
        this.vaultAddress,
        [
          'function getPoolTokens(bytes32) view returns (address[], uint256[], uint256)'
        ],
        this.provider
      );

      // Get all pools from factory
      const poolIds = await factory.getPools(0); // 0 for all pools
      const pairs = new Set();

      // Process each pool
      for (const poolId of poolIds) {
        try {
          const poolAddress = await factory.getPool(poolId);
          const [tokens] = await vault.getPoolTokens(poolId);

          // Create pairs from the tokens in the pool
          for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
              if (tokens[i] !== ethers.ZeroAddress && tokens[j] !== ethers.ZeroAddress) {
                pairs.add(JSON.stringify({
                  token0: tokens[i],
                  token1: tokens[j],
                  poolId: poolId,
                  poolAddress: poolAddress
                }));
              }
            }
          }
        } catch (error) {
          logger.warn(`Error processing Balancer pool ${poolId}: ${error.message}`);
          continue;
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching Balancer pairs:', error);
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

      const vault = new ethers.Contract(
        this.vaultAddress,
        [
          'function queryBatchSwap(uint8, tuple(bytes32,uint256,uint256,uint256,bytes)[]) view returns (int256[])'
        ],
        this.provider
      );

      // Create swap request
      const swapRequest = {
        poolId: pool.poolId,
        assetIn: tokenIn,
        assetOut: tokenOut,
        amount: amountIn,
        userData: '0x'
      };

      // Query the swap
      const result = await vault.queryBatchSwap(
        0, // GIVEN_IN
        [swapRequest]
      );

      const amountOut = result[0];
      const price = ethers.formatUnits(amountOut, 18) / ethers.formatUnits(amountIn, 18);

      return {
        source: this.name,
        price: price.toString(),
        amountOut: amountOut.toString()
      };
    } catch (error) {
      logger.error(`Error getting Balancer quote: ${error.message}`);
      return null;
    }
  }

  async findPool(tokenIn, tokenOut) {
    const pairs = await this.getPairs();
    return pairs.find(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    );
  }
}

export default BalancerDex; 