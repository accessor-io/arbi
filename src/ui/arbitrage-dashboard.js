import arbitrageService from '../services/arbitrage/ArbitrageService.js';
import { initCryptoCharts } from './crypto-charts.js';
import priceService from '../services/exchange/priceService.js';

/**
 * Crypto Arbitrage Dashboard Controller
 * Handles the UI interactions for the cryptocurrency arbitrage dashboard
 */
class ArbitrageDashboard {
  constructor() {
    this.filters = {
      type: 'all',
      minProfit: 0.5,
      maxGas: 50 // in Gwei
    };
    
    this.opportunitiesTable = document.getElementById('opportunities-table');
    this.executionsTable = document.getElementById('executions-table');
    this.lastScanTimeEl = document.getElementById('last-scan-time');
    this.typeSelect = document.getElementById('opportunity-type');
    this.minProfitInput = document.getElementById('min-profit');
    this.gasThresholdInput = document.getElementById('gas-threshold');
    this.scanButton = document.getElementById('scan-now');
    this.autoScanToggle = document.getElementById('auto-scan');
    
    this.executions = []; // Store recent executions
    
    this.bindEvents();
    this.initCharts();
  }
  
  /**
   * Initialize the dashboard
   */
  async init() {
    try {
      // Initialize the arbitrage service with any required config
      arbitrageService.init();
      
      // Perform initial data scan
      await arbitrageService.scan();
      
      // Update the UI with initial data
      this.updateDashboard();
      
      // Start auto-scanning if the toggle is enabled
      if (this.autoScanToggle.checked) {
        arbitrageService.startScanning(60000); // Scan every minute
      }
      
      // Fetch initial price data
      await this.updatePriceData();
      
      // Set up auto-refresh of prices
      setInterval(this.updatePriceData.bind(this), 60000); // Update every minute
      
      console.log('Crypto Arbitrage Dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      this.showError('Failed to initialize dashboard. Please try again later.');
    }
  }
  
  /**
   * Bind event listeners
   */
  bindEvents() {
    // Filter changes
    this.typeSelect.addEventListener('change', () => {
      this.filters.type = this.typeSelect.value;
      this.updateDashboard();
    });
    
    this.minProfitInput.addEventListener('change', () => {
      this.filters.minProfit = parseFloat(this.minProfitInput.value);
      this.updateDashboard();
    });
    
    this.gasThresholdInput.addEventListener('change', () => {
      this.filters.maxGas = parseFloat(this.gasThresholdInput.value);
      this.updateDashboard();
    });
    
    // Scan button
    this.scanButton.addEventListener('click', async () => {
      this.scanButton.disabled = true;
      this.scanButton.textContent = 'Scanning...';
      
      try {
        await arbitrageService.scan();
        this.updateDashboard();
      } catch (error) {
        console.error('Scan failed:', error);
        this.showError('Failed to scan for new opportunities.');
      } finally {
        this.scanButton.disabled = false;
        this.scanButton.textContent = 'Scan Now';
      }
    });
    
    // Auto-scan toggle
    this.autoScanToggle.addEventListener('change', () => {
      if (this.autoScanToggle.checked) {
        arbitrageService.startScanning(60000); // Scan every minute
      } else {
        arbitrageService.stopScanning();
      }
    });
    
    // Listen for scan completion events
    document.addEventListener('arbitrage-scan-complete', (event) => {
      this.updateDashboard();
    });
  }
  
  /**
   * Initialize charts
   */
  initCharts() {
    try {
      // Try to initialize charts with Chart.js
      const chartLoaded = typeof Chart !== 'undefined';
      
      if (chartLoaded) {
        // Load the charts module if Chart.js is available
        initCryptoCharts();
      } else {
        // Show placeholders if Chart.js is not available
        console.warn('Chart.js not detected, displaying placeholders instead');
        document.getElementById('exchange-chart').innerHTML = '<div class="chart-placeholder">Exchange comparison chart will be displayed here</div>';
        document.getElementById('token-chart').innerHTML = '<div class="chart-placeholder">Token arbitrage frequency chart will be displayed here</div>';
        document.getElementById('profit-gas-chart').innerHTML = '<div class="chart-placeholder">Profit vs gas cost analysis chart will be displayed here</div>';
        
        // Try to dynamically load Chart.js
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
          console.log('Chart.js loaded dynamically');
          initCryptoCharts();
        };
        document.head.appendChild(script);
      }
    } catch (error) {
      console.error('Error initializing charts:', error);
      // Display placeholders on error
      document.getElementById('exchange-chart').innerHTML = '<div class="chart-placeholder">Chart could not be loaded</div>';
      document.getElementById('token-chart').innerHTML = '<div class="chart-placeholder">Chart could not be loaded</div>';
      document.getElementById('profit-gas-chart').innerHTML = '<div class="chart-placeholder">Chart could not be loaded</div>';
    }
  }
  
  /**
   * Update the entire dashboard with current data
   */
  updateDashboard() {
    // Get filtered opportunities
    const opportunities = arbitrageService.getOpportunities(this.filters);
    
    // Update last scan time
    const lastScan = arbitrageService.getLastScanTime();
    if (lastScan) {
      this.lastScanTimeEl.textContent = `Last scan: ${lastScan.toLocaleTimeString()}`;
    }
    
    // Update opportunities table
    this.updateOpportunitiesTable(opportunities);
    
    // Update executions table
    this.updateExecutionsTable();
    
    // Update charts
    this.updateCharts(opportunities);
  }
  
  /**
   * Update the opportunities table with current data
   * @param {Array} opportunities - Array of opportunity objects
   */
  updateOpportunitiesTable(opportunities) {
    const tbody = this.opportunitiesTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (opportunities.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5">No opportunities found matching your filters.</td>';
      tbody.appendChild(row);
      return;
    }
    
    opportunities.forEach(opp => {
      const row = document.createElement('tr');
      if (opp.profit > 1.5) {
        row.classList.add('high-profit');
      }
      
      // Determine gas class
      const gasValue = parseFloat(opp.details.gasEstimate);
      let gasClass = 'gas-low';
      if (gasValue > 40) {
        gasClass = 'gas-high';
      } else if (gasValue > 20) {
        gasClass = 'gas-medium';
      }
      
      row.innerHTML = `
        <td>${opp.type === 'triangular' ? 'Triangular' : 'Exchange'}</td>
        <td>${opp.path}</td>
        <td class="profit-positive">${opp.profit.toFixed(2)}%</td>
        <td class="${gasClass}">${opp.details.gasEstimate}</td>
        <td>
          <button class="btn ${opp.isActionable ? 'btn-success' : 'btn-secondary'} btn-sm execute-btn" 
                  data-id="${opp.id}" 
                  ${opp.isActionable ? '' : 'disabled'}>
            ${opp.isActionable ? 'Execute' : 'Too Small'}
          </button>
          <button class="btn btn-info btn-sm details-btn" data-id="${opp.id}">Details</button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Add event listeners to buttons
    tbody.querySelectorAll('.execute-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await this.executeOpportunity(id);
      });
    });
    
    tbody.querySelectorAll('.details-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this.showOpportunityDetails(id);
      });
    });
  }
  
  /**
   * Update the executions table with recent executions
   */
  updateExecutionsTable() {
    const tbody = this.executionsTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (this.executions.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4">No recent executions</td>';
      tbody.appendChild(row);
      return;
    }
    
    this.executions.forEach(execution => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${execution.timestamp.toLocaleTimeString()}</td>
        <td>${execution.path}</td>
        <td class="profit-positive">${execution.profit.toFixed(2)}%</td>
        <td><span class="badge ${execution.success ? 'bg-success' : 'bg-danger'}">${execution.success ? 'Success' : 'Failed'}</span></td>
      `;
      
      tbody.appendChild(row);
    });
  }
  
  /**
   * Update all charts with current data
   * @param {Array} opportunities - Array of opportunity objects
   */
  updateCharts(opportunities) {
    // In a real implementation, this would update Chart.js instances
    // For now, we'll just log that charts would be updated
    console.log('Charts would be updated with', opportunities.length, 'opportunities');
  }
  
  /**
   * Execute an arbitrage opportunity
   * @param {string} id - ID of the opportunity to execute
   */
  async executeOpportunity(id) {
    try {
      // Show loading state
      const btn = this.opportunitiesTable.querySelector(`.execute-btn[data-id="${id}"]`);
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Executing...';
      
      // Get the opportunity details for our records
      const opportunity = arbitrageService.getOpportunities().find(opp => opp.id === id);
      
      // Execute the opportunity
      const result = await arbitrageService.executeOpportunity(id);
      
      // Add to executions history
      this.executions.unshift({
        id: result.id,
        timestamp: result.timestamp,
        path: opportunity.path,
        profit: opportunity.profit,
        success: result.success,
        executionTime: result.executionTime
      });
      
      // Keep only the 10 most recent executions
      if (this.executions.length > 10) {
        this.executions.pop();
      }
      
      // Show success message
      this.showSuccess(`Successfully executed opportunity with ${result.profit.toFixed(2)}% profit`);
      
      // Update the dashboard
      await arbitrageService.scan(); // Re-scan after execution
      this.updateDashboard();
    } catch (error) {
      console.error('Failed to execute opportunity:', error);
      this.showError(`Failed to execute opportunity: ${error.message}`);
      
      // Add to executions history as failed
      const opportunity = arbitrageService.getOpportunities().find(opp => opp.id === id);
      if (opportunity) {
        this.executions.unshift({
          id,
          timestamp: new Date(),
          path: opportunity.path,
          profit: opportunity.profit,
          success: false,
          executionTime: 0
        });
        
        // Keep only the 10 most recent executions
        if (this.executions.length > 10) {
          this.executions.pop();
        }
      }
      
      // Reset button state
      const btn = this.opportunitiesTable.querySelector(`.execute-btn[data-id="${id}"]`);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Retry';
      }
      
      // Update executions table
      this.updateExecutionsTable();
    }
  }
  
  /**
   * Show details for an opportunity
   * @param {string} id - ID of the opportunity to show details for
   */
  showOpportunityDetails(id) {
    // Find the opportunity
    const opportunities = arbitrageService.getOpportunities();
    const opportunity = opportunities.find(opp => opp.id === id);
    
    if (!opportunity) {
      console.error(`Opportunity with ID ${id} not found`);
      return;
    }
    
    // In a real implementation, this would show a modal with details
    // For now, we'll just alert the details
    alert(`
      Cryptocurrency Arbitrage Opportunity Details:
      
      Type: ${opportunity.type === 'triangular' ? 'Triangular Arbitrage' : 'Exchange Arbitrage'}
      Path: ${opportunity.path}
      Profit: ${opportunity.profit.toFixed(2)}%
      Timestamp: ${opportunity.timestamp.toLocaleString()}
      
      Estimated Volume: ${opportunity.details.estimatedVolume}
      Execution Time: ${opportunity.details.executionTime}
      Gas Estimate: ${opportunity.details.gasEstimate}
      Slippage: ${opportunity.details.slippage}
      Risk Level: ${opportunity.details.risk}
    `);
  }
  
  /**
   * Show an error message to the user
   * @param {string} message - Error message to show
   */
  showError(message) {
    // In a real implementation, this would show a toast or alert
    console.error(message);
    alert(`Error: ${message}`);
  }
  
  /**
   * Show a success message to the user
   * @param {string} message - Success message to show
   */
  showSuccess(message) {
    // In a real implementation, this would show a toast or alert
    console.log(message);
    alert(`Success: ${message}`);
  }
  
  /**
   * Fetch and display current cryptocurrency prices
   */
  async updatePriceData() {
    try {
      const priceContainer = document.getElementById('price-container');
      if (!priceContainer) return;
      
      // Show loading state
      priceContainer.innerHTML = '<div class="loading-indicator">Loading prices...</div>';
      
      // Fetch prices for major cryptocurrencies
      const prices = await priceService.getPrices([
        'bitcoin', 'ethereum', 'binancecoin', 'tether', 
        'ripple', 'cardano', 'solana', 'polkadot'
      ]);
      
      // Create price cards
      const priceHTML = Object.entries(prices).map(([coin, price]) => {
        // Format coin name
        const coinName = coin.charAt(0).toUpperCase() + coin.slice(1);
        // Add symbol based on coin
        const symbol = this.getSymbolForCoin(coin);
        
        return `
          <div class="price-card">
            <div class="price-coin">${coinName} <span class="price-symbol">${symbol}</span></div>
            <div class="price-value">$${price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}</div>
          </div>
        `;
      }).join('');
      
      // Update UI
      priceContainer.innerHTML = priceHTML;
      
      // Update last updated time
      const lastUpdatedElement = document.getElementById('prices-last-updated');
      if (lastUpdatedElement) {
        lastUpdatedElement.textContent = priceService.getLastUpdated();
      }
    } catch (error) {
      console.error('Failed to update price data:', error);
      const priceContainer = document.getElementById('price-container');
      if (priceContainer) {
        priceContainer.innerHTML = '<div class="error-message">Failed to load price data</div>';
      }
    }
  }
  
  /**
   * Get symbol for a given coin
   */
  getSymbolForCoin(coin) {
    const symbols = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'binancecoin': 'BNB',
      'tether': 'USDT',
      'ripple': 'XRP',
      'cardano': 'ADA',
      'solana': 'SOL',
      'polkadot': 'DOT'
    };
    
    return symbols[coin] || coin.substring(0, 3).toUpperCase();
  }
}

// Initialize the dashboard when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new ArbitrageDashboard();
  dashboard.init().catch(err => {
    console.error('Dashboard initialization failed:', err);
    alert('Dashboard failed to initialize. Please check the console for details.');
  });
});

export default ArbitrageDashboard; 