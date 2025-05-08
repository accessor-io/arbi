/**
 * Type definitions for the application
 */

/**
 * @typedef {Object} TokenInfo
 * @property {string} address - Token contract address
 * @property {string} symbol - Token symbol
 * @property {number} decimals - Token decimals
 * @property {string} name - Token name
 */

/**
 * @typedef {Object} PriceQuote
 * @property {string} dex - DEX identifier
 * @property {string} tokenIn - Input token address
 * @property {string} tokenOut - Output token address
 * @property {string} amountIn - Input amount in wei
 * @property {string} amountOut - Output amount in wei
 * @property {string} price - Price in wei
 * @property {number} priceImpact - Price impact percentage
 */

/**
 * @typedef {Object} ArbitrageOpportunity
 * @property {string} buyDex - DEX to buy from
 * @property {string} sellDex - DEX to sell to
 * @property {string} tokenIn - Input token address
 * @property {string} tokenOut - Output token address
 * @property {string} amountIn - Input amount in wei
 * @property {string} amountOut - Output amount in wei
 * @property {string} profit - Profit in wei
 * @property {number} profitPercentage - Profit percentage
 * @property {string} gasEstimate - Estimated gas cost in wei
 */

/**
 * @typedef {Object} TradeResult
 * @property {string} txHash - Transaction hash
 * @property {string} status - Transaction status
 * @property {string} amountIn - Input amount in wei
 * @property {string} amountOut - Output amount in wei
 * @property {string} gasUsed - Gas used in wei
 * @property {string} gasPrice - Gas price in wei
 * @property {string} profit - Profit in wei
 * @property {number} profitPercentage - Profit percentage
 */

/**
 * @typedef {Object} ServiceStatus
 * @property {boolean} isRunning - Whether the service is running
 * @property {boolean} isInitialized - Whether the service is initialized
 * @property {Object} metrics - Service metrics
 * @property {string} lastError - Last error message
 * @property {Date} lastUpdate - Last update timestamp
 */

export default {
  TokenInfo: {},
  PriceQuote: {},
  ArbitrageOpportunity: {},
  TradeResult: {},
  ServiceStatus: {}
}; 