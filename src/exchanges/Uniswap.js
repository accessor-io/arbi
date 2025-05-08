import BaseDex from './BaseDex.js';
import { ethers } from 'ethers';

class Uniswap extends BaseDex {
  constructor(provider) {
    // Uniswap V2 Router address
    super('Uniswap', provider, '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
  }

  async getTokenPrice(tokenAddress, baseTokenAddress, amountIn) {
    await this.loadABI();
    
    try {
      const path = [tokenAddress, baseTokenAddress];
      const amounts = await this.routerContract.getAmountsOut(
        amountIn,
        path
      );
      return {
        buyPrice: amountIn,
        sellPrice: amounts[1],
        price: amounts[1] / amountIn
      };
    } catch (error) {
      console.error('Error getting price from Uniswap:', error);
      return null;
    }
  }

  async executeTrade(wallet, path, amountIn, minAmountOut, deadline) {
    await this.loadABI();
    
    const connectedContract = this.routerContract.connect(wallet);
    
    const tx = await connectedContract.swapExactTokensForTokens(
      amountIn,
      minAmountOut,
      path,
      wallet.address,
      deadline,
      {
        gasLimit: 300000
      }
    );
    
    return tx;
  }
}

export default Uniswap;   