// Load charting library
import Chart from 'chart.js/auto';

// DOM elements
const profitChartCanvas = document.getElementById('profitChart');
const tokenPairsCanvas = document.getElementById('tokenPairsChart');
const statsContainer = document.getElementById('statsContainer');
const alertsContainer = document.getElementById('alertsContainer');

// Charts
let profitChart;
let tokenPairsChart;

// Initialize the dashboard
async function initDashboard() {
  // Load analytics data
  const analyticsData = await fetchAnalytics();
  
  // Render stats
  renderStats(analyticsData);
  
  // Render charts
  renderProfitChart(analyticsData.dailyProfit);
  renderTokenPairsChart(analyticsData.pairPerformance);
  
  // Set up real-time monitoring updates
  setupMonitoringUpdates();
  
  // Set up alert listener
  setupAlertListener();
}

// Fetch analytics data from the API
async function fetchAnalytics() {
  try {
    const response = await fetch('/api/analytics');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      totalProfit: 0,
      successRate: 0,
      dailyProfit: {},
      pairPerformance: {}
    };
  }
}

// Render key statistics
function renderStats(analyticsData) {
  statsContainer.innerHTML = `
    <div class="row">
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Total Profit</h5>
            <p class="card-text h2 ${analyticsData.totalProfit >= 0 ? 'text-success' : 'text-danger'}">
              ${analyticsData.totalProfit.toFixed(4)} ETH
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Success Rate</h5>
            <p class="card-text h2">
              ${analyticsData.successRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Total Trades</h5>
            <p class="card-text h2">
              ${analyticsData.totalTrades}
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Wallet Balance</h5>
            <p class="card-text h2">
              ${analyticsData.walletBalance ? analyticsData.walletBalance.toFixed(4) + ' ETH' : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render profit chart
function renderProfitChart(dailyProfit) {
  const labels = Object.keys(dailyProfit).sort();
  const data = labels.map(date => dailyProfit[date]);
  
  if (profitChart) {
    profitChart.destroy();
  }
  
  profitChart = new Chart(profitChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Profit (ETH)',
        data,
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Daily Profit'
        }
      }
    }
  });
}

// Render token pairs chart
function renderTokenPairsChart(pairPerformance) {
  const labels = Object.keys(pairPerformance);
  const data = labels.map(pair => pairPerformance[pair].totalProfit);
  const colors = generateColors(labels.length);
  
  if (tokenPairsChart) {
    tokenPairsChart.destroy();
  }
  
  tokenPairsChart = new Chart(tokenPairsCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Profit by Token Pair'
        }
      }
    }
  });
}

// Generate random colors for chart
function generateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137) % 360; // Use golden angle approximation for even distribution
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
}

// Set up monitoring updates
function setupMonitoringUpdates() {
  // Poll monitoring endpoint every 30 seconds
  setInterval(async () => {
    try {
      const response = await fetch('/api/monitoring');
      const metrics = await response.json();
      
      updateMetricsDisplay(metrics);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    }
  }, 30000);
}

// Update metrics display
function updateMetricsDisplay(metrics) {
  // Update system metrics
  document.getElementById('cpuUsage').textContent = `${metrics.system.cpuUsage.toFixed(1)}%`;
  document.getElementById('memoryUsage').textContent = `${metrics.system.memoryUsage.toFixed(1)}%`;
  
  // Update blockchain metrics
  document.getElementById('currentBlock').textContent = metrics.blockchain.blockNumber;
  document.getElementById('gasPrice').textContent = `${metrics.blockchain.gasPrice.toFixed(1)} Gwei`;
  
  // Update wallet metrics if available
  if (metrics.wallet && metrics.wallet.balanceEth !== undefined) {
    document.getElementById('walletBalance').textContent = `${metrics.wallet.balanceEth.toFixed(4)} ETH`;
  }
}

// Set up alert listener
function setupAlertListener() {
  // Create WebSocket connection for real-time alerts
  const alertSocket = new WebSocket(`ws://${window.location.host}/alerts`);
  
  alertSocket.onmessage = function(event) {
    const alert = JSON.parse(event.data);
    displayAlert(alert);
  };
  
  alertSocket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

// Display alert
function displayAlert(alert) {
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${getAlertClass(alert.type)} alert-dismissible fade show`;
  alertElement.innerHTML = `
    <strong>${formatAlertType(alert.type)}:</strong> ${alert.message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertsContainer.prepend(alertElement);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alertElement);
    bsAlert.close();
  }, 10000);
}

// Get Bootstrap alert class based on alert type
function getAlertClass(type) {
  switch (type) {
    case 'high_cpu_usage':
    case 'high_memory_usage':
    case 'high_gas_price':
      return 'warning';
    case 'low_wallet_balance':
    case 'blockchain_connection_error':
    case 'wallet_error':
    case 'monitoring_error':
      return 'danger';
    default:
      return 'info';
  }
}

// Format alert type for display
function formatAlertType(type) {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Initialize dashboard when document is ready
document.addEventListener('DOMContentLoaded', initDashboard); 