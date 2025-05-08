document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const scanningToggle = document.getElementById('scanningToggle');
  const scanIntervalInput = document.getElementById('scanInterval');
  const scanNowBtn = document.getElementById('scanNowBtn');
  const lastScanTimeEl = document.getElementById('lastScanTime');
  const opportunityCountEl = document.getElementById('opportunityCount');
  const opportunitiesTableEl = document.getElementById('opportunitiesTable');
  const slippageToleranceInput = document.getElementById('slippageTolerance');
  const minProfitThresholdInput = document.getElementById('minProfitThreshold');
  const modalSlippageInput = document.getElementById('modalSlippage');
  const tradeSummaryEl = document.getElementById('tradeSummary');
  const confirmTradeBtn = document.getElementById('confirmTradeBtn');
  const resultContentEl = document.getElementById('resultContent');
  
  // Bootstrap modal instances
  const executionModal = new bootstrap.Modal(document.getElementById('executionModal'));
  const resultModal = new bootstrap.Modal(document.getElementById('resultModal'));
  
  // Application state
  let opportunities = [];
  let selectedOpportunityIndex = -1;
  let isScanning = false;
  
  // Initialize
  initialize();
  
  // Event Listeners
  scanningToggle.addEventListener('change', toggleScanning);
  scanNowBtn.addEventListener('click', scanForOpportunities);
  confirmTradeBtn.addEventListener('click', executeArbitrage);
  
  // Initialize application
  async function initialize() {
    // Check if scanning is active
    try {
      const response = await fetch('/api/opportunities');
      const data = await response.json();
      
      if (data.opportunities && data.opportunities.length > 0) {
        opportunities = data.opportunities;
        updateOpportunitiesTable();
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }
  
  // Toggle automatic scanning
  async function toggleScanning() {
    const isActive = scanningToggle.checked;
    const intervalSeconds = parseInt(scanIntervalInput.value);
    
    try {
      const response = await fetch('/api/toggle-scanning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: isActive ? 'start' : 'stop',
          intervalSeconds: intervalSeconds
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        isScanning = data.scanning;
        updateScanningUI();
      } else {
        showError(`Failed to ${isActive ? 'start' : 'stop'} scanning: ${data.error}`);
        scanningToggle.checked = isScanning;
      }
    } catch (error) {
      console.error('Error toggling scanning:', error);
      showError(`Error toggling scanning: ${error.message}`);
      scanningToggle.checked = isScanning;
    }
  }
  
  // Update UI to reflect scanning status
  function updateScanningUI() {
    scanningToggle.checked = isScanning;
    scanIntervalInput.disabled = isScanning;
    
    if (isScanning) {
      scanNowBtn.classList.add('disabled');
      scanNowBtn.setAttribute('disabled', 'disabled');
    } else {
      scanNowBtn.classList.remove('disabled');
      scanNowBtn.removeAttribute('disabled');
    }
  }
  
  // Manual scan for arbitrage opportunities
  async function scanForOpportunities() {
    scanNowBtn.classList.add('disabled');
    scanNowBtn.setAttribute('disabled', 'disabled');
    scanNowBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scanning...';
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        opportunities = data.opportunities;
        updateOpportunitiesTable();
        lastScanTimeEl.textContent = new Date().toLocaleTimeString();
      } else {
        showError(`Scan failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      showError(`Error scanning: ${error.message}`);
    } finally {
      scanNowBtn.classList.remove('disabled');
      scanNowBtn.removeAttribute('disabled');
      scanNowBtn.textContent = 'Scan Now';
    }
  }
  
  // Update the opportunities table with current data
  function updateOpportunitiesTable() {
    opportunityCountEl.textContent = `${opportunities.length} found`;
    
    if (opportunities.length === 0) {
      opportunitiesTableEl.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">No opportunities found yet. Click "Scan Now" to search.</td>
        </tr>
      `;
      return;
    }
    
    const minProfitThreshold = parseFloat(minProfitThresholdInput.value);
    const filteredOpportunities = opportunities.filter(opp => opp.profitPercent >= minProfitThreshold);
    
    if (filteredOpportunities.length === 0) {
      opportunitiesTableEl.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">No opportunities meet the minimum profit threshold of ${minProfitThreshold}%.</td>
        </tr>
      `;
      return;
    }
    
    opportunitiesTableEl.innerHTML = filteredOpportunities.map((opp, index) => {
      const originalIndex = opportunities.indexOf(opp);
      return `
        <tr>
          <td>${opp.tokenA.symbol}/${opp.tokenB.symbol}</td>
          <td>${opp.buy.exchange} @ ${Number(opp.buy.price).toFixed(8)}</td>
          <td>${opp.sell.exchange} @ ${Number(opp.sell.price).toFixed(8)}</td>
          <td>${Number(opp.tokenA.amount).toFixed(4)} ${opp.tokenA.symbol}</td>
          <td class="profit-positive">${opp.profitPercent.toFixed(2)}%</td>
          <td class="profit-positive">${Number(opp.estimatedProfitInTokenB).toFixed(6)} ${opp.tokenB.symbol}</td>
          <td>
            <button class="btn btn-sm btn-success trade-btn" data-index="${originalIndex}">Trade</button>
          </td>
        </tr>
      `;
    }).join('');
    
    // Add event listeners to trade buttons
    document.querySelectorAll('.trade-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        showExecutionModal(index);
      });
    });
  }
  
  // Show execution confirmation modal
  function showExecutionModal(opportunityIndex) {
    selectedOpportunityIndex = opportunityIndex;
    const opp = opportunities[opportunityIndex];
    
    tradeSummaryEl.innerHTML = `
      <p><strong>Pair:</strong> ${opp.tokenA.symbol}/${opp.tokenB.symbol}</p>
      <p><strong>Buy:</strong> ${opp.tokenA.amount} ${opp.tokenA.symbol} on ${opp.buy.exchange} @ ${Number(opp.buy.price).toFixed(8)}</p>
      <p><strong>Sell:</strong> ~${opp.buy.amountOut} ${opp.tokenB.symbol} on ${opp.sell.exchange} @ ${Number(opp.sell.price).toFixed(8)}</p>
      <p><strong>Expected Profit:</strong> ${opp.profitPercent.toFixed(2)}% (${Number(opp.estimatedProfitInTokenB).toFixed(6)} ${opp.tokenB.symbol})</p>
      <div class="alert alert-danger mt-3">
        <strong>Warning:</strong> Market conditions may change rapidly. Actual results may differ from estimates.
      </div>
    `;
    
    // Set slippage to global setting
    modalSlippageInput.value = slippageToleranceInput.value;
    
    executionModal.show();
  }
  
  // Execute the arbitrage trade
  async function executeArbitrage() {
    if (selectedOpportunityIndex < 0) return;
    
    confirmTradeBtn.classList.add('disabled');
    confirmTradeBtn.setAttribute('disabled', 'disabled');
    confirmTradeBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Executing...';
    
    const slippageTolerance = parseFloat(modalSlippageInput.value);
    
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          opportunityIndex: selectedOpportunityIndex,
          slippageTolerance: slippageTolerance
        })
      });
      
      const result = await response.json();
      
      executionModal.hide();
      showResultModal(result);
      
      // Refresh opportunities as this one has been executed
      await scanForOpportunities();
      
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      showError(`Error executing trade: ${error.message}`);
    } finally {
      confirmTradeBtn.classList.remove('disabled');
      confirmTradeBtn.removeAttribute('disabled');
      confirmTradeBtn.textContent = 'Execute Trade';
    }
  }
  
  // Show result modal with trade outcome
  function showResultModal(result) {
    if (result.success) {
      resultContentEl.innerHTML = `
        <div class="alert alert-success">
          <h4 class="alert-heading">Trade Completed Successfully!</h4>
          <p>Your arbitrage trade has been executed.</p>
          <hr>
          <p class="mb-0"><strong>Buy Transaction:</strong> <a href="https://etherscan.io/tx/${result.result.buyTx}" target="_blank">${result.result.buyTx.substring(0, 10)}...${result.result.buyTx.substring(result.result.buyTx.length - 8)}</a></p>
          <p class="mb-0"><strong>Sell Transaction:</strong> <a href="https://etherscan.io/tx/${result.result.sellTx}" target="_blank">${result.result.sellTx.substring(0, 10)}...${result.result.sellTx.substring(result.result.sellTx.length - 8)}</a></p>
        </div>
      `;
    } else {
      resultContentEl.innerHTML = `
        <div class="alert alert-danger">
          <h4 class="alert-heading">Trade Failed</h4>
          <p>There was an error executing the arbitrage trade:</p>
          <p class="mb-0"><strong>Error:</strong> ${result.error}</p>
        </div>
      `;
    }
    
    resultModal.show();
  }
  
  // Display error notification
  function showError(message) {
    // You could implement a toast notification or another UI element
    alert(message);
  }
  
  // Filter opportunities when profit threshold changes
  minProfitThresholdInput.addEventListener('change', () => {
    updateOpportunitiesTable();
  });
}); 