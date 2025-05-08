// Dashboard Integration Module for Arbitrage Bot
// This file connects all services to the dashboard debugger

// Import Services
// If you're using CommonJS modules, you may need to adapt this
import MonitoringService from './services/monitoring/MonitoringService.js';
import LoggingService from './services/utils/LoggingService.js';
import GasService from './services/utils/GasService.js';
import AnalyticsService from './services/analytics/AnalyticsService.js';

// Create a global namespace for arbitrage services
window.arbitrage = window.arbitrage || {};

// Track if the module has been initialized
let initialized = false;

/**
 * Initialize the dashboard
 * @param {Object} config - Configuration options
 */
function initDashboard(config = {}) {
  if (initialized) {
    console.warn('Dashboard already initialized');
    return;
  }
  
  console.log('Initializing dashboard with config:', config);
  
  // Set up any global dashboard functionality
  setupGlobalEvents();
  
  // Mark as initialized
  initialized = true;
  
  return {
    isInitialized: () => initialized,
    getConfig: () => ({ ...config })
  };
}

/**
 * Set up global event listeners
 */
function setupGlobalEvents() {
  // Listen for dashboard events
  document.addEventListener('dashboard-event', (event) => {
    console.log('Dashboard event:', event.detail);
  });
  
  // Example: Set up demo charts if ChartJS is available
  if (window.Chart) {
    setupDemoCharts();
  }
}

/**
 * Set up demo charts for example pages
 */
function setupDemoCharts() {
  // Find chart containers on the page
  const chartContainers = document.querySelectorAll('.chart-container');
  
  // For each container, create a dummy chart
  chartContainers.forEach(container => {
    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);
    
    // Create a random chart type
    const chartTypes = ['line', 'bar', 'pie', 'doughnut'];
    const randomType = chartTypes[Math.floor(Math.random() * chartTypes.length)];
    
    // Create random data
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = labels.map(() => Math.floor(Math.random() * 100));
    
    // Create the chart
    new Chart(canvas, {
      type: randomType,
      data: {
        labels,
        datasets: [{
          label: 'Sample Data',
          data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  });
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Check if we should auto-initialize
  const dashboardEl = document.querySelector('[data-dashboard]');
  if (dashboardEl) {
    // Parse any JSON config from the data attribute
    let config = {};
    try {
      config = JSON.parse(dashboardEl.getAttribute('data-dashboard-config') || '{}');
    } catch (e) {
      console.error('Invalid dashboard config JSON:', e);
    }
    
    initDashboard(config);
  }
});

// Export the public API
export {
  initDashboard
};

// Make available globally
window.DashboardIntegration = { initDashboard };

// Initialize dashboard integration
export function initArbitrageDashboard() {
  console.log("Initializing arbitrage dashboard...");

  // Initialize debugger if not already done
  if (!window.arbitrageDebugger && typeof DashboardDebugger === 'function') {
    window.arbitrageDebugger = new DashboardDebugger({
      theme: 'dark',
      position: 'bottom-right',
      maxLogEntries: 500,
      allowConsoleCapture: true
    });
    
    console.log("Arbitrage debugger initialized");
  }
  
  // Initialize services adapter
  initializeServicesAdapter();
  
  // Connect dashboard UI to services
  connectDashboardUI();
  
  // Demo: Load sample data (remove in production)
  loadDemoData();
  
  console.log("Arbitrage dashboard initialization complete");
}

// Initialize service adapters to connect services to the dashboard
function initializeServicesAdapter() {
  // Create adapter for MonitoringService
  window.arbitrage.monitoringAdapter = {
    service: null,
    start: function(provider, wallet, options) {
      try {
        // In browser environment, we'd use a mock or connect to a real provider
        this.service = new MonitoringService(provider, wallet, options);
        
        // Register callback for alerts
        this.service.registerAlertCallback(alert => {
          if (window.arbitrageDebugger) {
            window.arbitrageDebugger.log('warn', `ALERT: ${alert.type} - ${alert.message}`);
          }
          
          // Update UI elements
          updateStatusPanel(this.service.getMetrics());
        });
        
        // Start monitoring
        this.service.start();
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Monitoring service started');
        }
        
        return this.service;
      } catch (error) {
        console.error("Failed to initialize monitoring service:", error);
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('error', 'Failed to initialize monitoring service: ' + error.message);
        }
      }
    }
  };
  
  // Create adapter for LoggingService
  window.arbitrage.loggingAdapter = {
    service: null,
    init: function(options) {
      try {
        // Initialize with custom handler that sends logs to the debugger
        this.service = new LoggingService({
          ...options,
          onLog: (level, message, meta) => {
            // Send to the debugger
            if (window.arbitrageDebugger) {
              window.arbitrageDebugger.log(level.toLowerCase(), message, meta);
            }
            
            // Update UI log panel
            addLogEntry(level, message, meta);
          }
        });
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Logging service initialized');
        }
        
        return this.service;
      } catch (error) {
        console.error("Failed to initialize logging service:", error);
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('error', 'Failed to initialize logging service: ' + error.message);
        }
      }
    }
  };
  
  // Create adapter for GasService
  window.arbitrage.gasAdapter = {
    service: null,
    init: function(provider, options) {
      try {
        this.service = new GasService(provider, options);
        
        // Set up event handler for gas price updates
        this.service.on('gasPriceUpdate', gasInfo => {
          // Update the debugger variable tracking
          if (window.arbitrageDebugger) {
            window.arbitrageDebugger.setVariable('gasInfo', gasInfo);
          }
          
          // Update UI gas panel
          updateGasPanel(gasInfo);
        });
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Gas service initialized');
        }
        
        return this.service;
      } catch (error) {
        console.error("Failed to initialize gas service:", error);
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('error', 'Failed to initialize gas service: ' + error.message);
        }
      }
    }
  };
  
  // Create adapter for AnalyticsService
  window.arbitrage.analyticsAdapter = {
    service: null,
    init: function(options) {
      try {
        this.service = new AnalyticsService(options);
        
        // Set up handlers for opportunity tracking
        this.service.on('opportunityDetected', opp => {
          if (window.arbitrageDebugger) {
            window.arbitrageDebugger.log('info', `Opportunity detected: ${opp.pair} (${opp.profit.toFixed(6)} ETH)`);
            window.arbitrageDebugger.setVariable('latestOpportunity', opp);
          }
          
          // Update UI
          addOpportunity(opp);
        });
        
        this.service.on('opportunityExecuted', result => {
          if (window.arbitrageDebugger) {
            window.arbitrageDebugger.log('info', `Opportunity executed: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.profit.toFixed(6)} ETH`);
          }
          
          // Update UI
          updateOpportunity(result);
          if (result.txHash) {
            addTransaction(result);
          }
        });
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Analytics service initialized');
        }
        
        return this.service;
      } catch (error) {
        console.error("Failed to initialize analytics service:", error);
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('error', 'Failed to initialize analytics service: ' + error.message);
        }
      }
    }
  };
}

// Connect UI elements to service data
function connectDashboardUI() {
  // Connect refresh buttons to service data
  document.getElementById('refresh-status').addEventListener('click', () => {
    if (window.arbitrage.monitoringAdapter && window.arbitrage.monitoringAdapter.service) {
      window.arbitrage.monitoringAdapter.service.checkHealth().then(metrics => {
        updateStatusPanel(metrics);
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Status panel refreshed');
        }
      });
    } else {
      console.warn("Monitoring service not initialized");
      if (window.arbitrageDebugger) {
        window.arbitrageDebugger.log('warn', 'Monitoring service not initialized');
      }
    }
  });
  
  document.getElementById('refresh-gas').addEventListener('click', () => {
    if (window.arbitrage.gasAdapter && window.arbitrage.gasAdapter.service) {
      window.arbitrage.gasAdapter.service.updateGasPrice().then(gasInfo => {
        updateGasPanel(gasInfo);
        
        if (window.arbitrageDebugger) {
          window.arbitrageDebugger.log('info', 'Gas panel refreshed');
        }
      });
    } else {
      console.warn("Gas service not initialized");
      if (window.arbitrageDebugger) {
        window.arbitrageDebugger.log('warn', 'Gas service not initialized');
      }
    }
  });
  
  // Add more UI connections for other panels
}

// UI update functions
function updateStatusPanel(metrics) {
  if (!metrics) return;
  
  if (metrics.system) {
    document.getElementById('cpu-usage').textContent = `${metrics.system.cpuUsage?.toFixed(1) || 0}%`;
    document.getElementById('memory-usage').textContent = `${formatMemory(metrics.system.memoryUsage)}`;
    document.getElementById('uptime').textContent = formatUptime(metrics.system.uptime);
  }
  
  if (metrics.blockchain) {
    document.getElementById('block-number').textContent = formatNumber(metrics.blockchain.blockNumber);
  }
  
  if (metrics.wallet) {
    document.getElementById('wallet-address').textContent = shortenAddress(metrics.wallet.address);
    document.getElementById('wallet-balance').textContent = `${metrics.wallet.balanceEth?.toFixed(4) || 0} ETH`;
  }
}

function updateGasPanel(gasInfo) {
  if (!gasInfo) return;
  
  document.getElementById('current-gas').textContent = `${gasInfo.current} Gwei`;
  document.getElementById('avg-gas-1h').textContent = `${gasInfo.hourlyAverage} Gwei`;
  document.getElementById('gas-used-24h').textContent = `${gasInfo.dailyUsage?.toFixed(4) || 0} ETH`;
  document.getElementById('gas-strategy').textContent = gasInfo.strategy || 'Normal';
}

function addLogEntry(level, message, meta) {
  const logEntries = document.getElementById('log-entries');
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-level log-${level.toLowerCase()}">${level.toUpperCase()}</span>
    <span class="log-message">${message}</span>
  `;
  
  logEntries.prepend(entry);
  
  // Limit number of visible log entries
  const maxEntries = 100;
  while (logEntries.children.length > maxEntries) {
    logEntries.removeChild(logEntries.lastChild);
  }
}

function addOpportunity(opp) {
  const opportunitiesTable = document.getElementById('opportunities-table');
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${timeStr}</td>
    <td>${opp.pair}</td>
    <td>${opp.route}</td>
    <td class="${opp.profit > 0 ? 'positive' : 'negative'}">
      ${opp.profit > 0 ? '+' : ''}${opp.profit.toFixed(4)} ETH
    </td>
    <td>Pending</td>
  `;
  
  if (opportunitiesTable.firstChild) {
    opportunitiesTable.insertBefore(row, opportunitiesTable.firstChild);
  } else {
    opportunitiesTable.appendChild(row);
  }
  
  // Limit number of visible opportunities
  const maxRows = 10;
  while (opportunitiesTable.children.length > maxRows) {
    opportunitiesTable.removeChild(opportunitiesTable.lastChild);
  }
}

function updateOpportunity(result) {
  // For demo, this is simplified. In production, you would find the specific row
  const opportunitiesTable = document.getElementById('opportunities-table');
  if (opportunitiesTable.firstChild) {
    opportunitiesTable.firstChild.lastChild.textContent = result.success ? 'Executed' : 'Failed';
  }
}

function addTransaction(tx) {
  const transactionsTable = document.getElementById('transactions-table');
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${timeStr}</td>
    <td>${tx.type || 'Swap'}</td>
    <td>${shortenAddress(tx.txHash)}</td>
    <td>${tx.status || 'Pending'}</td>
    <td>${tx.gasUsed?.toFixed(4) || '0.000'} ETH</td>
  `;
  
  if (transactionsTable.firstChild) {
    transactionsTable.insertBefore(row, transactionsTable.firstChild);
  } else {
    transactionsTable.appendChild(row);
  }
  
  // Limit number of visible transactions
  const maxRows = 10;
  while (transactionsTable.children.length > maxRows) {
    transactionsTable.removeChild(transactionsTable.lastChild);
  }
}

// Helper functions
function formatMemory(memoryPercent) {
  if (typeof memoryPercent !== 'number') return '0MB / 0MB';
  
  // This is a mock since we don't have real system memory info in browser
  const totalMemGB = 16; // Assume 16GB total
  const usedMemGB = totalMemGB * (memoryPercent / 100);
  
  return `${usedMemGB.toFixed(1)}GB / ${totalMemGB}GB`;
}

function formatUptime(seconds) {
  if (typeof seconds !== 'number') return '0m';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  result += `${minutes}m`;
  
  return result;
}

function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function shortenAddress(address) {
  if (!address) return '';
  if (typeof address !== 'string') return '';
  
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Load demo data for testing
function loadDemoData() {
  // Mock service calls for demonstration
  console.log("Loading demo data...");
  
  // Demo system metrics
  updateStatusPanel({
    system: {
      cpuUsage: 25.3,
      memoryUsage: 38.7,
      uptime: 3600 * 24 * 2 + 3600 * 8 + 60 * 15 // 2d 8h 15m
    },
    blockchain: {
      blockNumber: 14325982
    },
    wallet: {
      address: '0x1a2b3c4d5e6f7g8h9i0j',
      balanceEth: 4.2893
    }
  });
  
  // Demo gas info
  updateGasPanel({
    current: 45,
    hourlyAverage: 38,
    dailyUsage: 0.12,
    strategy: 'Aggressive'
  });
  
  // Demo logs
  const demoLogs = [
    { level: 'INFO', message: 'Arbitrage bot started' },
    { level: 'INFO', message: 'Connected to Ethereum mainnet' },
    { level: 'INFO', message: 'Monitoring prices on Uniswap, SushiSwap, and Balancer' },
    { level: 'INFO', message: 'Gas price strategy set to "Aggressive"' },
    { level: 'WARN', message: 'Gas prices rising, currently at 45 Gwei' }
  ];
  
  demoLogs.forEach(log => {
    addLogEntry(log.level, log.message);
  });
  
  // Add to debugger too
  if (window.arbitrageDebugger) {
    window.arbitrageDebugger.log('info', 'Demo data loaded to dashboard');
    demoLogs.forEach(log => {
      window.arbitrageDebugger.log(log.level.toLowerCase(), log.message);
    });
  }
} 