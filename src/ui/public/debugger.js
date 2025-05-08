document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const logContainer = document.getElementById('logContainer');
  const autoRefreshLogsBtn = document.getElementById('autoRefreshLogs');
  const clearLogsBtn = document.getElementById('clearLogs');
  const refreshStateBtn = document.getElementById('refreshState');
  const arbitrageStateEl = document.getElementById('arbitrageState');
  const autoTraderStateEl = document.getElementById('autoTraderState');
  const monitoringStateEl = document.getElementById('monitoringState');
  const tasksStateEl = document.getElementById('tasksState');
  const systemStateEl = document.getElementById('systemState');
  const testComponentSelect = document.getElementById('testComponent');
  const exchangeParamsDiv = document.getElementById('exchangeParams');
  const tokenManagerParamsDiv = document.getElementById('tokenManagerParams');
  const gasParamsDiv = document.getElementById('gasParams');
  const runTestBtn = document.getElementById('runTest');
  const structuredDataEl = document.getElementById('structuredData');
  const resultsModal = new bootstrap.Modal(document.getElementById('resultsModal'));
  
  // State
  let autoRefreshLogs = false;
  let logRefreshInterval = null;
  let stateData = null;
  
  // Popular tokens for quick testing
  const popularTokens = {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  };
  
  // Initialize
  init();
  
  function init() {
    // Set up event listeners
    autoRefreshLogsBtn.addEventListener('click', toggleAutoRefreshLogs);
    clearLogsBtn.addEventListener('click', clearLogs);
    refreshStateBtn.addEventListener('click', fetchState);
    testComponentSelect.addEventListener('change', updateTestParams);
    runTestBtn.addEventListener('click', runTest);
    
    // Initial data load
    fetchLogs();
    fetchState();
    
    // Populate token dropdowns with popular tokens
    populateTokenDropdowns();
    
    // Add input change detection for token addresses
    document.getElementById('tokenA').addEventListener('input', function() {
      document.getElementById('tokenASelect').value = detectTokenFromAddress(this.value);
    });
    
    document.getElementById('tokenB').addEventListener('input', function() {
      document.getElementById('tokenBSelect').value = detectTokenFromAddress(this.value);
    });
    
    document.getElementById('tokenAddress').addEventListener('input', function() {
      document.getElementById('tokenAddressSelect').value = detectTokenFromAddress(this.value);
    });
    
    // Add these event listeners in init() function
    document.getElementById('lookupTokenA').addEventListener('click', async function() {
      const symbol = document.getElementById('tokenASymbol').value.trim();
      if (!symbol) return;
      
      this.disabled = true;
      try {
        const result = await lookupTokenBySymbol(symbol);
        if (result.success) {
          document.getElementById('tokenA').value = result.address;
          document.getElementById('tokenASelect').value = detectTokenFromAddress(result.address);
        } else {
          alert(`Token not found: ${result.error}`);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        this.disabled = false;
      }
    });
  }
  
  function populateTokenDropdowns() {
    // Get references to select elements
    const tokenASelect = document.getElementById('tokenASelect');
    const tokenBSelect = document.getElementById('tokenBSelect');
    const tokenAddressSelect = document.getElementById('tokenAddressSelect');
    
    // Get references to input fields
    const tokenA = document.getElementById('tokenA');
    const tokenB = document.getElementById('tokenB');
    const tokenAddress = document.getElementById('tokenAddress');
    
    // Set default values
    tokenASelect.value = 'WETH';
    tokenBSelect.value = 'USDC';
    tokenAddressSelect.value = 'WETH';
    
    tokenA.value = popularTokens['WETH'];
    tokenB.value = popularTokens['USDC'];
    tokenAddress.value = popularTokens['WETH'];
    
    // Add event listeners for the select elements
    tokenASelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        tokenA.value = '';
        tokenA.focus();
      } else {
        tokenA.value = popularTokens[this.value];
      }
    });
    
    tokenBSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        tokenB.value = '';
        tokenB.focus();
      } else {
        tokenB.value = popularTokens[this.value];
      }
    });
    
    tokenAddressSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        tokenAddress.value = '';
        tokenAddress.focus();
      } else {
        tokenAddress.value = popularTokens[this.value];
      }
    });
  }
  
  function toggleAutoRefreshLogs() {
    autoRefreshLogs = !autoRefreshLogs;
    
    if (autoRefreshLogs) {
      autoRefreshLogsBtn.classList.remove('btn-outline-primary');
      autoRefreshLogsBtn.classList.add('btn-primary');
      autoRefreshLogsBtn.textContent = 'Auto-refresh: ON';
      
      // Start interval
      logRefreshInterval = setInterval(fetchLogs, 5000);
    } else {
      autoRefreshLogsBtn.classList.remove('btn-primary');
      autoRefreshLogsBtn.classList.add('btn-outline-primary');
      autoRefreshLogsBtn.textContent = 'Auto-refresh';
      
      // Clear interval
      if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
      }
    }
  }
  
  function clearLogs() {
    logContainer.innerHTML = '';
  }
  
  async function fetchLogs() {
    try {
      const response = await fetch('/api/debug/logs?count=100');
      const data = await response.json();
      
      // Check if logs are available
      if (data.logs && Array.isArray(data.logs)) {
        renderLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }
  
  function renderLogs(logs) {
    // Clear existing logs if requested
    if (logContainer.dataset.cleared === 'true') {
      logContainer.innerHTML = '';
      logContainer.dataset.cleared = 'false';
    }
    
    // Create HTML for each log entry
    const logHTML = logs.map(log => {
      // Format timestamp
      const date = new Date(log.timestamp);
      const formattedTime = date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
      
      // Determine log level color
      const levelClass = `log-level-${log.level}`;
      
      // Format data if present
      let dataHTML = '';
      if (log.data) {
        try {
          const formattedData = typeof log.data === 'string' 
            ? log.data 
            : JSON.stringify(log.data, null, 2);
          dataHTML = `<pre class="mb-0 mt-1 ps-3 code-snippet">${formattedData}</pre>`;
        } catch (e) {
          dataHTML = `<pre class="mb-0 mt-1 ps-3 code-snippet">${log.data}</pre>`;
        }
      }
      
      return `
        <div class="log-entry ${levelClass}">
          <span class="time">${formattedTime}</span>
          <span class="level">[${log.level.toUpperCase()}]</span>
          <span class="message">${log.message}</span>
          ${dataHTML}
        </div>
      `;
    }).join('');
    
    // Update the log container
    logContainer.innerHTML = logHTML + logContainer.innerHTML;
  }
  
  async function fetchState() {
    try {
      const response = await fetch('/api/debug/state');
      stateData = await response.json();
      
      renderState(stateData);
    } catch (error) {
      console.error('Error fetching state:', error);
    }
  }
  
  function renderState(state) {
    // Render arbitrage service state
    if (state.arbitrageService) {
      arbitrageStateEl.innerHTML = `
        <div class="mb-3">
          <strong>Scanning:</strong> ${state.arbitrageService.isScanning ? 'Active' : 'Inactive'}<br>
          <strong>Opportunities:</strong> ${state.arbitrageService.opportunities}<br>
          <strong>Exchanges:</strong> ${state.arbitrageService.exchanges.length}
        </div>
        <div>
          <strong>Supported Exchanges:</strong>
          <ul>
            ${state.arbitrageService.exchanges.map(e => 
              `<li>${e.name} (ABI: ${e.abiLoaded ? 'Loaded' : 'Not Loaded'})</li>`
            ).join('')}
          </ul>
        </div>
      `;
    }
    
    // Render auto trader state
    if (state.autoTrader) {
      autoTraderStateEl.innerHTML = `
        <div>
          <strong>Status:</strong> ${state.autoTrader.isRunning ? 'Running' : 'Stopped'}<br>
          <strong>Min Profit:</strong> ${state.autoTrader.minProfitPercent}%<br>
          <strong>Max Trade:</strong> ${state.autoTrader.maxTradeAmount} ETH<br>
          <strong>Slippage Tolerance:</strong> ${state.autoTrader.slippageTolerance}%
        </div>
      `;
    } else {
      autoTraderStateEl.innerHTML = '<div class="text-muted">Auto trader not configured</div>';
    }
    
    // Render monitoring service state
    if (state.monitoringService && state.monitoringService.metrics) {
      const metrics = state.monitoringService.metrics;
      
      monitoringStateEl.innerHTML = `
        <div class="mb-3">
          <strong>System:</strong><br>
          ${metrics.system ? `
            CPU: ${metrics.system.cpuUsage ? (metrics.system.cpuUsage * 100).toFixed(1) + '%' : 'N/A'}<br>
            Memory: ${metrics.system.memoryUsage ? (metrics.system.memoryUsage * 100).toFixed(1) + '%' : 'N/A'}<br>
          ` : 'No system metrics available'}
        </div>
        <div class="mb-3">
          <strong>Blockchain:</strong><br>
          ${metrics.blockchain ? `
            Gas Price: ${metrics.blockchain.gasPrice ? metrics.blockchain.gasPrice + ' Gwei' : 'N/A'}<br>
            Block Number: ${metrics.blockchain.blockNumber || 'N/A'}<br>
          ` : 'No blockchain metrics available'}
        </div>
        <div>
          <strong>Wallet:</strong><br>
          ${metrics.wallet ? `
            Balance: ${metrics.wallet.balance ? metrics.wallet.balance + ' ETH' : 'N/A'}<br>
          ` : 'No wallet metrics available'}
        </div>
      `;
    } else {
      monitoringStateEl.innerHTML = '<div class="text-muted">Monitoring service not active</div>';
    }
    
    // Render task scheduler state
    if (state.taskScheduler) {
      tasksStateEl.innerHTML = `
        <div>
          <strong>Active Tasks:</strong> ${state.taskScheduler.activeTasks.length}<br>
          <ul>
            ${state.taskScheduler.activeTasks.map(task => `<li>${task}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    // Render system state
    if (state.system) {
      const memoryMB = state.system.memoryUsage.rss / (1024 * 1024);
      const heapMB = state.system.memoryUsage.heapUsed / (1024 * 1024);
      const totalHeapMB = state.system.memoryUsage.heapTotal / (1024 * 1024);
      
      systemStateEl.innerHTML = `
        <div>
          <strong>Memory Usage:</strong> ${memoryMB.toFixed(2)} MB<br>
          <strong>Heap Used:</strong> ${heapMB.toFixed(2)} MB / ${totalHeapMB.toFixed(2)} MB<br>
          <strong>Uptime:</strong> ${formatUptime(state.system.uptime)}<br>
        </div>
      `;
    }
  }
  
  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days}d `;
    if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptimeStr += `${minutes}m `;
    uptimeStr += `${seconds}s`;
    
    return uptimeStr;
  }
  
  function updateTestParams() {
    const component = testComponentSelect.value;
    
    // Hide all params divs
    exchangeParamsDiv.classList.add('d-none');
    tokenManagerParamsDiv.classList.add('d-none');
    gasParamsDiv.classList.add('d-none');
    
    // Show the correct one
    if (component === 'exchange') {
      exchangeParamsDiv.classList.remove('d-none');
    } else if (component === 'tokenManager') {
      tokenManagerParamsDiv.classList.remove('d-none');
    } else if (component === 'gas') {
      gasParamsDiv.classList.remove('d-none');
    }
  }
  
  async function runTest() {
    const component = testComponentSelect.value;
    let action, params;
    
    // Prepare action and params based on component
    if (component === 'exchange') {
      action = 'getPrice';
      params = {
        name: document.getElementById('exchangeName').value,
        tokenA: document.getElementById('tokenA').value,
        tokenB: document.getElementById('tokenB').value,
        amount: document.getElementById('amount').value
      };
    } else if (component === 'tokenManager') {
      action = 'loadToken';
      params = {
        address: document.getElementById('tokenAddress').value
      };
    } else if (component === 'gas') {
      action = 'getPrice';
      params = {};
    }
    
    try {
      // Show loading state
      runTestBtn.disabled = true;
      runTestBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...';
      
      // Make API call
      const response = await fetch('/api/debug/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          component,
          action,
          params
        })
      });
      
      const result = await response.json();
      
      // Display result in structured view
      if (result.success) {
        displayStructuredData(result.result);
      } else {
        displayStructuredData({ error: result.error });
      }
      
      // Show the modal
      resultsModal.show();
    } catch (error) {
      console.error('Error running test:', error);
      displayStructuredData({ error: error.message });
      resultsModal.show();
    } finally {
      // Reset button state
      runTestBtn.disabled = false;
      runTestBtn.textContent = 'Run Test';
    }
  }
  
  function displayStructuredData(data) {
    // Format the data as JSON with syntax highlighting
    let formattedJson;
    
    try {
      formattedJson = JSON.stringify(data, null, 2);
    } catch (e) {
      formattedJson = "Error formatting data: " + e.message;
    }
    
    structuredDataEl.innerHTML = `<pre class="code-snippet">${formattedJson}</pre>`;
  }
  
  // Add a function to detect if an input address is a known token
  function detectTokenFromAddress(address) {
    for (const [symbol, addr] of Object.entries(popularTokens)) {
      if (addr.toLowerCase() === address.toLowerCase()) {
        return symbol;
      }
    }
    return 'custom';
  }
  
  // Add this function to do a token lookup by symbol
  async function lookupTokenBySymbol(symbol) {
    try {
      // Check if it's a popular token first
      if (popularTokens[symbol]) {
        return { success: true, address: popularTokens[symbol] };
      }
      
      // Try to lookup via API
      const response = await fetch(`/api/tokens/lookup?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json();
      
      if (data.success && data.address) {
        return data;
      }
      
      return { success: false, error: 'Token not found' };
    } catch (error) {
      console.error('Error looking up token:', error);
      return { success: false, error: error.message };
    }
  }
}); 