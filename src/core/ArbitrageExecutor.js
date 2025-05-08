import { ethers } from 'ethers';

class ArbitrageExecutor {
  constructor(exchanges, tokenManager) {
    this.exchanges = exchanges;
    this.tokenManager = tokenManager;
  }
  
  /**
   * Initializes the executor by validating exchanges and token manager.
   * @returns {Promise<boolean>} True if initialization was successful.
   */
  async initialize() {
    try {
      logger.info('[ArbitrageExecutor] Starting initialization...');

      // Validate exchanges
      if (!this.exchanges || !Array.isArray(this.exchanges) || this.exchanges.length === 0) {
        throw new Error('No exchanges configured');
      }

      // Validate token manager
      if (!this.tokenManager || typeof this.tokenManager.loadToken !== 'function') {
        throw new Error('Invalid token manager');
      }

      // Validate each exchange
      for (const exchange of this.exchanges) {
        if (!exchange.name || typeof exchange.executeTrade !== 'function') {
          throw new Error(`Invalid exchange configuration: ${exchange.name || 'unnamed'}`);
        }
        logger.info(`[ArbitrageExecutor] Validated exchange: ${exchange.name}`);
      }

      logger.info('[ArbitrageExecutor] Initialization completed successfully');
      return true;
    } catch (error) {
      logger.error('[ArbitrageExecutor] Initialization failed:', error);
      throw error;
    }
  }
  
  findExchange(exchangeName) {
    return this.exchanges.find(e => e.name === exchangeName);
  }
  
  async executeArbitrage(wallet, opportunity, slippageTolerance = 0.5) {
    // 1. Find the exchange objects
    const buyExchange = this.findExchange(opportunity.buy.exchange);
    const sellExchange = this.findExchange(opportunity.sell.exchange);
    
    if (!buyExchange || !sellExchange) {
      throw new Error('Exchange not found');
    }
    
    // 2. Load token details
    const tokenA = await this.tokenManager.loadToken(opportunity.tokenA.address);
    const tokenB = await this.tokenManager.loadToken(opportunity.tokenB.address);
    
    // 3. Check allowances
    const buyExchangeAllowance = await this.tokenManager.checkAllowance(
      tokenA.address,
      wallet.address,
      buyExchange.routerAddress
    );
    
    if (parseFloat(buyExchangeAllowance) < parseFloat(opportunity.tokenA.amount)) {
      console.log(`Approving ${tokenA.symbol} for ${buyExchange.name}...`);
      const approveTx = await this.tokenManager.approveToken(
        wallet,
        tokenA.address,
        buyExchange.routerAddress,
        opportunity.tokenA.amount
      );
      await approveTx.wait();
      console.log(`Approved ${tokenA.symbol} for ${buyExchange.name}`);
    }
    
    // 4. Calculate minimum amount out with slippage
    const amountIn = ethers.utils.parseUnits(opportunity.tokenA.amount, tokenA.decimals);
    const expectedAmountOut = ethers.utils.parseUnits(opportunity.buy.amountOut, tokenB.decimals);
    const minAmountOut = expectedAmountOut.mul(
      ethers.BigNumber.from(Math.floor((100 - slippageTolerance) * 100))
    ).div(ethers.BigNumber.from(10000));
    
    // 5. Calculate deadline (30 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 30 * 60;
    
    // 6. Execute buy transaction
    console.log(`Executing buy on ${buyExchange.name}...`);
    const buyTx = await buyExchange.executeTrade(
      wallet,
      [tokenA.address, tokenB.address],
      amountIn,
      minAmountOut,
      deadline
    );
    
    const buyReceipt = await buyTx.wait();
    console.log(`Buy transaction confirmed: ${buyReceipt.transactionHash}`);
    
    // 7. Check if we received the expected amount of tokenB
    const tokenBBalance = await this.tokenManager.getBalance(tokenB.address, wallet.address);
    console.log(`Received ${tokenBBalance} ${tokenB.symbol}`);
    
    // 8. Check allowance for sell exchange
    const sellExchangeAllowance = await this.tokenManager.checkAllowance(
      tokenB.address,
      wallet.address,
      sellExchange.routerAddress
    );
    
    if (parseFloat(sellExchangeAllowance) < parseFloat(tokenBBalance)) {
      console.log(`Approving ${tokenB.symbol} for ${sellExchange.name}...`);
      const approveTx = await this.tokenManager.approveToken(
        wallet,
        tokenB.address,
        sellExchange.routerAddress,
        tokenBBalance
      );
      await approveTx.wait();
      console.log(`Approved ${tokenB.symbol} for ${sellExchange.name}`);
    }
    
    // 9. Execute sell transaction
    const amountBToSell = ethers.utils.parseUnits(tokenBBalance, tokenB.decimals);
    const expectedSellAmountOut = ethers.utils.parseUnits(
      (parseFloat(tokenBBalance) * opportunity.sell.price).toString(),
      tokenA.decimals
    );
    const minSellAmountOut = expectedSellAmountOut.mul(
      ethers.BigNumber.from(Math.floor((100 - slippageTolerance) * 100))
    ).div(ethers.BigNumber.from(10000));
    
    console.log(`Executing sell on ${sellExchange.name}...`);
    const sellTx = await sellExchange.executeTrade(
      wallet,
      [tokenB.address, tokenA.address],
      amountBToSell,
      minSellAmountOut,
      deadline
    );
    
    const sellReceipt = await sellTx.wait();
    console.log(`Sell transaction confirmed: ${sellReceipt.transactionHash}`);
    
    // 10. Return the result
    return {
      buyTx: buyReceipt.transactionHash,
      sellTx: sellReceipt.transactionHash,
      status: 'completed'
    };
  }
}

export default ArbitrageExecutor; 