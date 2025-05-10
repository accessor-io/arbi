import BaseDex from './BaseDex.js';
import { ethers } from 'ethers';

class Sushiswap extends BaseDex {
  constructor(provider, config = {}) {
    super(provider, {
      name: 'Sushiswap',
      version: 'v2',
      routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Sushiswap Router V2
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', // Sushiswap Factory V2
      network: config.network || 'ethereum',
      ...config
    });
  }

  async getTokenPrice(tokenAddress, baseTokenAddress, amount) {
    try {
      await this.loadABI();
      
      if (!this.routerContract) {
        throw new Error('Router contract not initialized');
      }

      const path = [tokenAddress, baseTokenAddress];
      const amounts = await this.routerContract.getAmountsOut(amount, path);
      
      if (!amounts || amounts.length < 2) {
        throw new Error('Invalid amounts returned from router');
      }

      return amounts[1];
    } catch (error) {
      console.error(`Error getting price from Sushiswap:`, error);
      throw error;
    }
  }

  async getLiquidity(tokenAddress, baseTokenAddress) {
    try {
      await this.loadABI();
      
      const pairAddress = await this.getPairAddress(tokenAddress, baseTokenAddress);
      if (!pairAddress) {
        return { token0: '0', token1: '0' };
      }

      const pairContract = new ethers.Contract(
        pairAddress,
        ['function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'],
        this.provider
      );

      const reserves = await pairContract.getReserves();
      return {
        token0: reserves[0].toString(),
        token1: reserves[1].toString()
      };
    } catch (error) {
      console.error(`Error getting liquidity from Sushiswap:`, error);
      throw error;
    }
  }

  async getPairAddress(tokenAddress, baseTokenAddress) {
    try {
      const factoryContract = new ethers.Contract(
        this.config.factoryAddress,
        ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
        this.provider
      );

      return await factoryContract.getPair(tokenAddress, baseTokenAddress);
    } catch (error) {
      console.error(`Error getting pair address from Sushiswap:`, error);
      throw error;
    }
  }

  async getReserves(tokenAddress, baseTokenAddress) {
    try {
      const pairAddress = await this.getPairAddress(tokenAddress, baseTokenAddress);
      if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
        return { reserve0: '0', reserve1: '0' };
      }

      const pairContract = new ethers.Contract(
        pairAddress,
        ['function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'],
        this.provider
      );

      const reserves = await pairContract.getReserves();
      return {
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString()
      };
    } catch (error) {
      console.error(`Error getting reserves from Sushiswap:`, error);
      throw error;
    }
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    try {
      await this.loadABI();
      
      if (!this.routerContract) {
        throw new Error('Router contract not initialized');
      }

      const path = [tokenIn, tokenOut];
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      
      if (!amounts || amounts.length < 2) {
        throw new Error('Invalid amounts returned from router');
      }

      return {
        amountIn: amounts[0].toString(),
        amountOut: amounts[1].toString(),
        path
      };
    } catch (error) {
      console.error(`Error getting swap quote from Sushiswap:`, error);
      throw error;
    }
  }

  async executeTrade(wallet, path, amount, minAmountOut, deadline) {
    try {
      await this.loadABI();
      
      if (!this.routerContract) {
        throw new Error('Router contract not initialized');
      }

      const tx = await this.routerContract.connect(wallet).swapExactTokensForTokens(
        amount,
        minAmountOut,
        path,
        wallet.address,
        deadline
      );

      return await tx.wait();
    } catch (error) {
      console.error(`Error executing trade on Sushiswap:`, error);
      throw error;
    }
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.config.factoryAddress,
        [
          'function allPairsLength() view returns (uint256)',
          'function allPairs(uint256) view returns (address)'
        ],
        this.provider
      );

      const pairsLength = await factory.allPairsLength();
      const pairs = [];
      
      // Fetch first 100 pairs to start
      const batchSize = 100;
      const endIndex = Math.min(pairsLength.toNumber(), batchSize);
      
      for (let i = 0; i < endIndex; i++) {
        try {
          const pairAddress = await factory.allPairs(i);
          const pairContract = new ethers.Contract(
            pairAddress,
            [
              'function token0() view returns (address)',
              'function token1() view returns (address)',
              'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
            ],
            this.provider
          );

          const [token0, token1, reserves] = await Promise.all([
            pairContract.token0(),
            pairContract.token1(),
            pairContract.getReserves()
          ]);

          // Only include pairs with non-zero reserves
          if (reserves.reserve0.gt(0) && reserves.reserve1.gt(0)) {
            pairs.push({
              address: pairAddress,
              token0,
              token1,
              reserve0: reserves.reserve0,
              reserve1: reserves.reserve1,
              dex: this.name
            });
          }
        } catch (error) {
          console.debug(`Error fetching pair ${i} from ${this.name}:`, error.message);
          continue;
        }
      }

      console.info(`[${this.name}] Fetched ${pairs.length} pairs`);
      return pairs;
    } catch (error) {
      console.error(`Error fetching pairs from ${this.name}:`, error);
      return [];
    }
  }
}

export default Sushiswap; 