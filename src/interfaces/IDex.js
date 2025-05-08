/**
 * Interface for DEX implementations
 */
export default class IDex {
  constructor(provider, config) {
    if (this.constructor === IDex) {
      throw new Error('Cannot instantiate abstract class');
    }
    this.provider = provider;
    this.config = config;
  }

  /**
   * Get the price of a token in terms of another token
   * @param {string} tokenIn - Address of input token
   * @param {string} tokenOut - Address of output token
   * @param {string} amountIn - Amount of input token in wei
   * @returns {Promise<string>} Amount of output token in wei
   */
  async getPrice(tokenIn, tokenOut, amountIn) {
    throw new Error('Method not implemented');
  }

  /**
   * Get the liquidity for a token pair
   * @param {string} tokenA - Address of first token
   * @param {string} tokenB - Address of second token
   * @returns {Promise<{token0: string, token1: string}>} Liquidity amounts in wei
   */
  async getLiquidity(tokenA, tokenB) {
    throw new Error('Method not implemented');
  }

  /**
   * Get a quote for swapping tokens
   * @param {string} tokenIn - Address of input token
   * @param {string} tokenOut - Address of output token
   * @param {string} amountIn - Amount of input token in wei
   * @returns {Promise<{amountIn: string, amountOut: string, path: string[]}>} Quote details
   */
  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    throw new Error('Method not implemented');
  }

  /**
   * Execute a token swap
   * @param {object} wallet - Wallet instance
   * @param {string[]} path - Array of token addresses in the swap path
   * @param {string} amountIn - Amount of input token in wei
   * @param {string} minAmountOut - Minimum amount of output token in wei
   * @param {number} deadline - Unix timestamp deadline
   * @returns {Promise<object>} Transaction receipt
   */
  async executeTrade(wallet, path, amountIn, minAmountOut, deadline) {
    throw new Error('Method not implemented');
  }
} 