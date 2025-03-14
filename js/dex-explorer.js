import priceService from './services/priceService.js';

// Initialize the DEX explorer
document.addEventListener('DOMContentLoaded', () => {
  initDexExplorer();
});

async function initDexExplorer() {
  try {
    // Get default chain ID (e.g., from local storage or config)
    const chainId = localStorage.getItem('selectedChainId') || '1';
    
    // Initialize UI elements
    initUI();
    
    // Fetch and display token list
    await fetchTokenList(chainId);
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('DEX Explorer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize DEX Explorer:', error);
    displayErrorMessage('Failed to initialize. Please check console for details.');
  }
}

async function fetchTokenList(chainId) {
  try {
    // Example tokens - in a real app, fetch from an API
    const tokens = [
      { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI', name: 'Dai Stablecoin' },
      { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', name: 'Wrapped Ether' },
      // Add more tokens
    ];
    
    // Fetch prices for tokens
    await enrichTokensWithPrices(tokens, chainId);
    
    // Render token list
    renderTokenList(tokens);
  } catch (error) {
    console.error('Error fetching token list:', error);
    displayErrorMessage('Failed to load tokens. Please try again later.');
  }
}

async function enrichTokensWithPrices(tokens, chainId) {
  // Create an array of promises to fetch prices concurrently
  const pricePromises = tokens.map(async (token) => {
    try {
      token.price = await priceService.getTokenPrice(token.address, chainId);
    } catch (error) {
      console.warn(`Failed to fetch price for ${token.symbol}:`, error);
      token.price = null;
    }
    return token;
  });
  
  // Wait for all price fetches to complete
  await Promise.all(pricePromises);
  console.log('All token prices fetched');
}

function renderTokenList(tokens) {
  const tokenListElement = document.getElementById('token-list');
  if (!tokenListElement) {
    console.error('Token list element not found');
    return;
  }
  
  tokenListElement.innerHTML = '';
  
  tokens.forEach(token => {
    const tokenElement = document.createElement('div');
    tokenElement.className = 'token-item';
    
    tokenElement.innerHTML = `
      <div class="token-info">
        <span class="token-symbol">${token.symbol}</span>
        <span class="token-name">${token.name}</span>
      </div>
      <div class="token-price ${token.price ? '' : 'price-unavailable'}">
        ${token.price ? `$${token.price.toFixed(4)}` : 'Price unavailable'}
      </div>
    `;
    
    tokenListElement.appendChild(tokenElement);
  });
}

function initUI() {
  // Initialize UI components
  const appContainer = document.getElementById('app');
  if (!appContainer) return;
  
  appContainer.innerHTML = `
    <div class="explorer-header">
      <h1>DEX Explorer</h1>
      <div class="network-selector">
        <select id="network-select">
          <option value="1">Ethereum</option>
          <option value="56">BSC</option>
          <option value="137">Polygon</option>
        </select>
      </div>
    </div>
    <div class="token-container">
      <h2>Tokens</h2>
      <div id="token-list" class="token-list">
        <div class="loading">Loading tokens...</div>
      </div>
    </div>
    <div id="error-message" class="error-message"></div>
  `;
}

function setupEventListeners() {
  const networkSelect = document.getElementById('network-select');
  if (networkSelect) {
    networkSelect.addEventListener('change', async (e) => {
      const chainId = e.target.value;
      localStorage.setItem('selectedChainId', chainId);
      await fetchTokenList(chainId);
    });
  }
}

function displayErrorMessage(message) {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
} 