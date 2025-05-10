import BaseDex from './BaseDex.js';
import { ethers } from 'ethers';

class UniswapDex extends BaseDex {
  constructor(provider, config = {}) {
    super(provider, {
      name: 'Uniswap',
      version: 'v2',
      routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router V2
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap Factory V2
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
      console.error(`Error getting price from Uniswap:`, error);
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
      console.error(`Error getting liquidity from Uniswap:`, error);
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
      console.error(`Error getting pair address from Uniswap:`, error);
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
      console.error(`Error getting reserves from Uniswap:`, error);
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
      console.error(`Error getting swap quote from Uniswap:`, error);
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
      console.error(`Error executing trade on Uniswap:`, error);
      throw error;
    }
  }

  async getPairs() {
    console.warn('getPairs not implemented for UniswapDex');
    return [];
  }
}

export default UniswapDex; 