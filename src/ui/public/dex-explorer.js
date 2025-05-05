// Add this at the top of your file, before any imports
// This ensures the mock API is used in development but not in production
// if (!window.fetch.toString().includes('Mocking API call')) {
//   console.log('Using real API endpoints');
// }

import { ethers } from 'ethers';
import GasService from '../../services/GasService';
import Uniswap from '../../exchanges/Uniswap';
import config from '../../config/config';

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(config.api.infura);

// Initialize services
const gasService = new GasService(provider);
const uniswap = new Uniswap(provider);

// Global variables
let currentChain = '1';
let currentDex = '';

// Display gas prices
async function updateGasPrices() {
  try {
    const gasPrices = await gasService.getCurrentGasPrice();
    const gasDisplay = document.getElementById('gas-prices');
    
    if (gasDisplay) {
      gasDisplay.innerHTML = `
        <div class="gas-card">
          <h3>Standard Gas</h3>
          <div class="gas-value">${gasPrices.standard} gwei</div>
        </div>
        ${gasPrices.maxFeePerGas ? `
          <div class="gas-card">
            <h3>Max Fee</h3>
            <div class="gas-value">${gasPrices.maxFeePerGas} gwei</div>
          </div>
        ` : ''}
        ${gasPrices.maxPriorityFeePerGas ? `
          <div class="gas-card">
            <h3>Priority Fee</h3>
            <div class="gas-value">${gasPrices.maxPriorityFeePerGas} gwei</div>
          </div>
        ` : ''}
      `;
    }
  } catch (error) {
    console.error('Error updating gas prices:', error);
  }
}

// Initialize network info
function initNetworkInfo() {
  const networkInfo = document.getElementById('network-info');
  if (networkInfo) {
    const networkName = getNetworkName(config.network.defaultChainId);
    networkInfo.innerHTML = `Connected to: <strong>${networkName}</strong>`;
  }
}

// Helper to get network name
function getNetworkName(chainId) {
  const networks = {
    1: 'Ethereum Mainnet',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon'
  };
  return networks[chainId] || `Chain ID ${chainId}`;
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DEX Explorer initialized');
  initNetworkInfo();
  updateGasPrices();
  
  // Update gas prices every minute
  setInterval(updateGasPrices, 60000);
  
  // DOM Elements
  const dexList = document.getElementById('dexList');
  const tokenTableBody = document.getElementById('tokenTableBody');
  const tokenLimit = document.getElementById('tokenLimit');
  const refreshBtn = document.getElementById('refreshBtn');
  const compareBtn = document.getElementById('compareBtn');
  const selectAllTokens = document.getElementById('selectAllTokens');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const comparisonTableHead = document.getElementById('comparisonTableHead');
  const comparisonTableBody = document.getElementById('comparisonTableBody');
  const exportComparisonBtn = document.getElementById('exportComparisonBtn');
  const comparisonModal = new bootstrap.Modal(document.getElementById('comparisonModal'));
  const tokenSearch = document.getElementById('tokenSearch');
  const chainSelect = document.getElementById('chainSelect');
  
  // State
  const state = {
    dexes: [],
    selectedDex: null,
    tokenData: {},
    selectedTokens: new Set(),
    isLoading: false,
    currentChain: '1' // Default to Ethereum mainnet
  };
  
  // Initialize
  init();
  
  async function init() {
    // Set up event listeners
    refreshBtn.addEventListener('click', loadTokenData);
    tokenLimit.addEventListener('change', loadTokenData);
    compareBtn.addEventListener('click', showComparisonModal);
    selectAllTokens.addEventListener('change', toggleAllTokens);
    exportComparisonBtn.addEventListener('click', exportComparison);
    tokenSearch.addEventListener('input', debounce(filterTokens, 300));
    chainSelect.addEventListener('change', handleChainChange);
    
    // Load initial data
    await loadDexes();
    await loadTokenData();
  }
  
  async function handleChainChange(e) {
    state.currentChain = e.target.value;
    await loadTokenData();
  }
  
  async function loadDexes() {
    setLoading(true);
    
    try {
      // Fetch available DEXes from API
      const response = await fetch(`/api/exchanges?chain=${state.currentChain}`);
      const data = await response.json();
      
      if (data.success && data.exchanges) {
        state.dexes = data.exchanges;
        
        // Render DEX list
        renderDexList();
        
        // Select first DEX by default
        if (state.dexes.length > 0) {
          selectDex(state.dexes[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading DEXes:', error);
      showError('Failed to load DEX list. Please try again later.');
    } finally {
      setLoading(false);
    }
  }
  
  function renderDexList() {
    dexList.innerHTML = '';
    
    state.dexes.forEach(dex => {
      const listItem = document.createElement('a');
      listItem.className = `list-group-item list-group-item-action dex-selector ${dex.id === state.selectedDex ? 'active' : ''}`;
      listItem.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <span>${dex.name}</span>
          <span class="badge bg-primary">${dex.version || 'v2'}</span>
        </div>
      `;
      listItem.dataset.dexId = dex.id;
      
      listItem.addEventListener('click', () => {
        selectDex(dex.id);
      });
      
      dexList.appendChild(listItem);
    });
  }
  
  function selectDex(dexId) {
    state.selectedDex = dexId;
    
    // Update UI
    document.querySelectorAll('.dex-selector').forEach(el => {
      el.classList.toggle('active', el.dataset.dexId === dexId);
    });
    
    // Load tokens for selected DEX
    loadTokenData();
  }
  
  async function loadTokenData() {
    if (!state.selectedDex) return;
    
    setLoading(true);
    state.selectedTokens.clear();
    
    try {
      const limit = parseInt(tokenLimit.value);
      const response = await fetch(`/api/dex/top-tokens?dex=${state.selectedDex}&chain=${state.currentChain}&limit=${limit}`);
      const data = await response.json();
      
      if (data.success && data.results) {
        const dexName = state.dexes.find(d => d.id === state.selectedDex)?.name;
        state.tokenData = data.results[dexName] || [];
        
        renderTokenTable();
      }
    } catch (error) {
      console.error('Error loading token data:', error);
      showError('Failed to load token data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }
  
  function renderTokenTable() {
    tokenTableBody.innerHTML = '';
    
    state.tokenData.forEach(token => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="form-check">
            <input class="form-check-input token-selector" type="checkbox" value="${token.address}">
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <img src="/api/tokens/${token.address}/icon" alt="${token.symbol}" class="token-icon me-2" onerror="this.src='/img/default-token.png'">
            <div>
              <div class="fw-bold">${token.symbol}</div>
              <div class="small text-muted">${token.name}</div>
            </div>
          </div>
        </td>
        <td>$${parseFloat(token.priceUsd).toFixed(4)}</td>
        <td>$${formatNumber(token.volume24h)}</td>
        <td>$${formatNumber(token.liquidity)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary compare-token" data-token="${token.address}">
            Compare
          </button>
        </td>
      `;
      
      // Add event listeners
      const checkbox = row.querySelector('.token-selector');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedTokens.add(token.address);
        } else {
          state.selectedTokens.delete(token.address);
        }
        updateCompareButton();
      });
      
      const compareBtn = row.querySelector('.compare-token');
      compareBtn.addEventListener('click', () => {
        state.selectedTokens.clear();
        state.selectedTokens.add(token.address);
        showComparisonModal();
      });
      
      tokenTableBody.appendChild(row);
    });
    
    updateCompareButton();
  }
  
  function filterTokens() {
    const searchTerm = tokenSearch.value.toLowerCase();
    const rows = tokenTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const tokenSymbol = row.querySelector('.fw-bold').textContent.toLowerCase();
      const tokenName = row.querySelector('.text-muted').textContent.toLowerCase();
      
      if (tokenSymbol.includes(searchTerm) || tokenName.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
  
  function updateCompareButton() {
    compareBtn.disabled = state.selectedTokens.size === 0;
  }
  
  function toggleAllTokens(e) {
    const checkboxes = tokenTableBody.querySelectorAll('.token-selector');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      if (e.target.checked) {
        state.selectedTokens.add(checkbox.value);
      } else {
        state.selectedTokens.delete(checkbox.value);
      }
    });
    updateCompareButton();
  }
  
  async function showComparisonModal() {
    if (state.selectedTokens.size === 0) return;
    
    setLoading(true);
    
    try {
      const comparisonData = await Promise.all(
        Array.from(state.selectedTokens).map(fetchTokenPricesAcrossDEXes)
      );
      
      renderComparisonTable(comparisonData);
      comparisonModal.show();
    } catch (error) {
      console.error('Error showing comparison:', error);
      showError('Failed to load comparison data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }
  
  async function fetchTokenPricesAcrossDEXes(tokenAddress) {
    try {
      const response = await fetch(`/api/tokens/${tokenAddress}/prices?chain=${state.currentChain}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          address: tokenAddress,
          symbol: data.symbol,
          name: data.name,
          prices: data.prices
        };
      }
      
      throw new Error(data.error || 'Failed to fetch token prices');
    } catch (error) {
      console.error(`Error fetching prices for ${tokenAddress}:`, error);
      return {
        address: tokenAddress,
        symbol: 'Unknown',
        name: 'Unknown',
        prices: {}
      };
    }
  }
  
  function renderComparisonTable(comparisonData) {
    // Generate table header
    const headerRow = document.createElement('tr');
    
    // First column for token names
    headerRow.appendChild(document.createElement('th'));
    
    // Get all DEX names from the data
    const allDexes = new Set();
    comparisonData.forEach(token => {
      Object.keys(token.prices).forEach(dex => allDexes.add(dex));
    });
    
    // Add DEX columns
    Array.from(allDexes).sort().forEach(dex => {
      const th = document.createElement('th');
      th.textContent = dex;
      headerRow.appendChild(th);
    });
    
    // Add best price column
    const bestPriceTh = document.createElement('th');
    bestPriceTh.textContent = 'Best Price';
    headerRow.appendChild(bestPriceTh);
    
    // Add arbitrage column
    const arbitrageTh = document.createElement('th');
    arbitrageTh.textContent = 'Max Arbitrage';
    headerRow.appendChild(arbitrageTh);
    
    // Set header
    comparisonTableHead.innerHTML = '';
    comparisonTableHead.appendChild(headerRow);
    
    // Generate table body
    comparisonTableBody.innerHTML = '';
    
    comparisonData.forEach(token => {
      const row = document.createElement('tr');
      
      // Token info cell
      const tokenCell = document.createElement('td');
      tokenCell.innerHTML = `<strong>${token.symbol}</strong><br><small>${token.name}</small>`;
      row.appendChild(tokenCell);
      
      // Calculate min and max prices
      let minPrice = Infinity;
      let maxPrice = 0;
      let minDex = '';
      let maxDex = '';
      
      // Add price cells for each DEX
      Array.from(allDexes).sort().forEach(dex => {
        const td = document.createElement('td');
        
        if (token.prices[dex]) {
          const price = parseFloat(token.prices[dex].price);
          td.textContent = `$${price.toFixed(6)}`;
          
          if (price < minPrice) {
            minPrice = price;
            minDex = dex;
          }
          
          if (price > maxPrice) {
            maxPrice = price;
            maxDex = dex;
          }
        } else {
          td.textContent = 'N/A';
          td.className = 'text-muted';
        }
        
        row.appendChild(td);
      });
      
      // Best price cell
      const bestPriceCell = document.createElement('td');
      if (minPrice !== Infinity) {
        bestPriceCell.innerHTML = `$${minPrice.toFixed(6)}<br><small class="text-muted">${minDex}</small>`;
      } else {
        bestPriceCell.textContent = 'N/A';
      }
      row.appendChild(bestPriceCell);
      
      // Arbitrage cell
      const arbitrageCell = document.createElement('td');
      if (minPrice !== Infinity && maxPrice > 0) {
        const profitPercent = ((maxPrice / minPrice) - 1) * 100;
        arbitrageCell.innerHTML = `
          ${profitPercent.toFixed(2)}%<br>
          <small class="text-muted">${minDex} → ${maxDex}</small>
        `;
      } else {
        arbitrageCell.textContent = 'N/A';
      }
      row.appendChild(arbitrageCell);
      
      comparisonTableBody.appendChild(row);
    });
  }
  
  function exportComparison() {
    const rows = comparisonTableBody.querySelectorAll('tr');
    const csv = [];
    
    // Add header
    const header = ['Token', ...Array.from(comparisonTableHead.querySelectorAll('th')).map(th => th.textContent)];
    csv.push(header.join(','));
    
    // Add data rows
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const rowData = Array.from(cells).map(cell => {
        // Remove HTML tags and normalize text
        return cell.textContent.replace(/\n/g, ' ').trim();
      });
      csv.push(rowData.join(','));
    });
    
    // Create and download file
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dex-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  function setLoading(isLoading) {
    state.isLoading = isLoading;
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
  }
  
  function showError(message) {
    // Implement error display logic
    console.error(message);
  }
  
  function formatNumber(num) {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      maximumFractionDigits: 2
    }).format(num);
  }
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Add these functions to handle route finding and arbitrage
  async function findBestRoute() {
    const tokenIn = document.getElementById('tokenIn').value;
    const tokenOut = document.getElementById('tokenOut').value;
    const amountIn = document.getElementById('amountIn').value;
    const chainId = document.getElementById('chainSelect').value;

    if (!tokenIn || !tokenOut || !amountIn) {
      showError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/dex/route?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amount=${amountIn}&chain=${chainId}`);
      const data = await response.json();

      if (data.success) {
        displayRoute(data.route);
      } else {
        showError(data.error || 'Failed to find route');
      }
    } catch (error) {
      console.error('Error finding route:', error);
      showError('Failed to find route');
    } finally {
      setLoading(false);
    }
  }

  function displayRoute(route) {
    const routeSteps = document.getElementById('routeSteps');
    const totalOutput = document.getElementById('totalOutput');
    const routeProfit = document.getElementById('routeProfit');
    const routeResult = document.getElementById('routeResult');

    routeSteps.innerHTML = '';
    
    route.hops.forEach((hop, index) => {
      const step = document.createElement('div');
      step.className = 'route-step';
      step.innerHTML = `
        <div class="d-flex align-items-center">
          <span>${hop.tokenIn}</span>
          <i class="bi bi-arrow-right route-arrow"></i>
          <span>${hop.tokenOut}</span>
          <span class="ms-auto badge bg-primary">${hop.dex}</span>
        </div>
        <div class="small text-muted">
          Amount In: ${hop.amountIn}<br>
          Amount Out: ${hop.amountOut}
        </div>
      `;
      routeSteps.appendChild(step);
    });

    totalOutput.textContent = route.totalAmountOut;
    routeProfit.textContent = `${(route.profit * 100).toFixed(2)}%`;
    routeProfit.className = route.profit > 0 ? 'price-diff-positive' : 'price-diff-negative';
    
    routeResult.style.display = 'block';
  }

  async function loadArbitrageOpportunities() {
    const chainId = document.getElementById('chainSelect').value;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/dex/arbitrage?chain=${chainId}`);
      const data = await response.json();

      if (data.success) {
        displayArbitrageOpportunities(data.opportunities);
      } else {
        showError(data.error || 'Failed to load arbitrage opportunities');
      }
    } catch (error) {
      console.error('Error loading arbitrage opportunities:', error);
      showError('Failed to load arbitrage opportunities');
    } finally {
      setLoading(false);
    }
  }

  function displayArbitrageOpportunities(opportunities) {
    const tableBody = document.getElementById('arbitrageTableBody');
    tableBody.innerHTML = '';

    opportunities.forEach(opp => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${opp.tokenIn}</td>
        <td>${opp.tokenOut}</td>
        <td class="${opp.profit > 0 ? 'price-diff-positive' : 'price-diff-negative'}">
          ${(opp.profit * 100).toFixed(2)}%
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="showRouteDetails('${opp.tokenIn}', '${opp.tokenOut}')">
            View Route
          </button>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-success" onclick="executeArbitrage('${opp.tokenIn}', '${opp.tokenOut}')">
            Execute
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  async function showRouteDetails(tokenIn, tokenOut) {
    document.getElementById('tokenIn').value = tokenIn;
    document.getElementById('tokenOut').value = tokenOut;
    document.getElementById('amountIn').value = '1';
    await findBestRoute();
  }

  async function executeArbitrage(tokenIn, tokenOut) {
    // This would be implemented based on your execution service
    showError('Arbitrage execution not implemented yet');
  }

  // Add event listeners
  document.addEventListener('DOMContentLoaded', () => {
    // ... existing event listeners ...
    
    // Add new event listeners
    document.getElementById('findRouteBtn').addEventListener('click', findBestRoute);
    document.getElementById('refreshArbitrageBtn').addEventListener('click', loadArbitrageOpportunities);
    
    // Load initial arbitrage opportunities
    loadArbitrageOpportunities();
  });

  // Set up chain selection
  document.getElementById('chainSelect').addEventListener('change', async (e) => {
    currentChain = e.target.value;
    await loadDexes();
    await loadTopTokens();
    await loadArbitrageOpportunities();
  });

  // Set up DEX selection
  document.getElementById('dexSelect').addEventListener('change', async (e) => {
    currentDex = e.target.value;
    await loadTopTokens();
    await loadArbitrageOpportunities();
  });

  // Initial load
  loadDexes();
  loadTopTokens();
  loadArbitrageOpportunities();
}); 