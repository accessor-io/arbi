// Mock API data
const mockData = {
  exchanges: [
    { id: 'uniswap_v2', name: 'Uniswap V2' },
    { id: 'uniswap_v3', name: 'Uniswap V3' },
    { id: 'sushiswap', name: 'SushiSwap' }
  ],
  tokens: {
    uniswap_v2: Array(50).fill(null).map((_, index) => ({
      address: `0x${index.toString(16).padStart(40, '0')}`,
      name: `Token ${index + 1}`,
      symbol: `TKN${index + 1}`,
      priceUsd: (Math.random() * 100).toFixed(4),
      volume24h: Math.random() * 10000000,
      liquidity: Math.random() * 50000000
    }))
  }
};

// Mock fetch implementations
window.fetch = (url) => {
  console.log('Mocking API call to:', url);
  
  // Return a Promise that resolves to a mock Response
  return new Promise((resolve) => {
    let responseBody = { success: false, error: 'Not implemented' };
    
    if (url === '/api/exchanges') {
      responseBody = { 
        success: true, 
        exchanges: mockData.exchanges 
      };
    } else if (url.includes('/api/dex/top-tokens')) {
      const dexId = new URL('http://example.com' + url).searchParams.get('dex');
      responseBody = { 
        success: true, 
        results: {
          [mockData.exchanges.find(d => d.id === dexId)?.name || 'Uniswap V2']: mockData.tokens.uniswap_v2
        }
      };
    } else if (url.includes('/api/tokens/')) {
      const tokenAddress = url.split('/api/tokens/')[1].split('/')[0];
      const token = mockData.tokens.uniswap_v2.find(t => t.address === tokenAddress) || {
        address: tokenAddress,
        name: 'Unknown Token',
        symbol: 'UNKNOWN'
      };
      
      responseBody = {
        success: true,
        name: token.name,
        symbol: token.symbol,
        prices: {
          'Uniswap V2': { price: (Math.random() * 100).toFixed(6) },
          'Uniswap V3': { price: (Math.random() * 100).toFixed(6) },
          'SushiSwap': { price: (Math.random() * 100).toFixed(6) }
        }
      };
    }
    
    setTimeout(() => {
      resolve({
        ok: true,
        json: () => Promise.resolve(responseBody)
      });
    }, 500); // Add a small delay to simulate network
  });
}; 