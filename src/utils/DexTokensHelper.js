// This will provide a mock implementation for getTopTokens until 
// proper integration with external APIs is implemented
const mockTopTokens = [
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    priceUsd: '1850.42',
    volume24h: 1234567890,
    liquidity: 9876543210
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    priceUsd: '1.00',
    volume24h: 987654321,
    liquidity: 8765432109
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    priceUsd: '1.00',
    volume24h: 876543210,
    liquidity: 7654321098
  },
  // Add more mock tokens as needed
];

function getTopTokensMock(dexName, limit = 50) {
  // Add some variance in price/volume based on DEX name to simulate differences
  const variance = dexName.charCodeAt(0) % 10 / 100; // 0-9% variance
  
  return mockTopTokens.slice(0, Math.min(limit, mockTopTokens.length)).map(token => ({
    ...token,
    priceUsd: (parseFloat(token.priceUsd) * (1 + variance)).toString(),
    volume24h: Math.floor(token.volume24h * (1 + variance)),
    liquidity: Math.floor(token.liquidity * (1 + variance))
  }));
}

export {
  getTopTokensMock
};
