/**
 * Application constants
 */

// Network Constants
export const NETWORKS = {
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  ARBITRUM: {
    chainId: 42161,
    name: 'Arbitrum',
    symbol: 'ETH'
  }
};

// Token Constants
export const TOKENS = {
  WETH: {
    ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
  }
};

// DEX Constants
export const DEXES = {
  UNISWAP: 'uniswap',
  SUSHISWAP: 'sushiswap',
  PANCAKESWAP: 'pancakeswap'
};

// Error Messages
export const ERRORS = {
  INVALID_NETWORK: 'Invalid network specified',
  INVALID_TOKEN: 'Invalid token address',
  INSUFFICIENT_LIQUIDITY: 'Insufficient liquidity for trade',
  PRICE_IMPACT_TOO_HIGH: 'Price impact too high',
  SLIPPAGE_TOO_HIGH: 'Slippage tolerance exceeded',
  INSUFFICIENT_BALANCE: 'Insufficient balance for trade'
};

// Default Values
export const DEFAULTS = {
  SLIPPAGE_TOLERANCE: 0.5, // 0.5%
  PRICE_IMPACT_LIMIT: 1.0, // 1%
  MIN_LIQUIDITY: '1000000000000000000', // 1 ETH
  GAS_LIMIT_MULTIPLIER: 1.2, // 20% buffer
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
};

// Event Types
export const EVENTS = {
  OPPORTUNITY_FOUND: 'opportunity:found',
  TRADE_EXECUTED: 'trade:executed',
  TRADE_FAILED: 'trade:failed',
  BALANCE_UPDATED: 'balance:updated',
  PRICE_UPDATED: 'price:updated'
}; 