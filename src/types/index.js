/**
 * Type definitions for the application
 */

// Define the types as actual objects
const TokenInfo = {
  address: '',
  symbol: '',
  decimals: 0,
  name: ''
};

const PriceQuote = {
  dex: '',
  tokenIn: '',
  tokenOut: '',
  amountIn: '',
  amountOut: '',
  price: '',
  priceImpact: 0
};

const ArbitrageOpportunity = {
  buyDex: '',
  sellDex: '',
  tokenIn: '',
  tokenOut: '',
  amountIn: '',
  amountOut: '',
  profit: '',
  profitPercentage: 0,
  gasEstimate: ''
};

const TradeResult = {
  txHash: '',
  status: '',
  amountIn: '',
  amountOut: '',
  gasUsed: '',
  gasPrice: '',
  profit: '',
  profitPercentage: 0
};

const ServiceStatus = {
  isRunning: false,
  isInitialized: false,
  metrics: {},
  lastError: '',
  lastUpdate: new Date()
};

// Export the types
export { TokenInfo, PriceQuote, ArbitrageOpportunity, TradeResult, ServiceStatus };

// Also export as default for backward compatibility
export default {
  TokenInfo,
  PriceQuote,
  ArbitrageOpportunity,
  TradeResult,
  ServiceStatus
}; 