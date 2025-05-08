/**
 * Crypto-specific chart configurations
 * Requires Chart.js to be loaded
 */
export function initCryptoCharts() {
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded. Charts will not be displayed.');
    return false;
  }
  
  // Exchange comparison chart
  if (document.getElementById('exchange-chart')) {
    const ctx = document.getElementById('exchange-chart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Binance', 'Coinbase', 'Kraken', 'Huobi', 'FTX', 'Kucoin'],
        datasets: [{
          label: 'Arbitrage Opportunities Found',
          data: [12, 8, 10, 5, 7, 9],
          backgroundColor: [
            'rgba(54, 162, 235, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
            'rgba(255, 159, 64, 0.5)',
            'rgba(255, 99, 132, 0.5)',
            'rgba(255, 206, 86, 0.5)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  
  // Token arbitrage frequency chart
  if (document.getElementById('token-chart')) {
    const ctx = document.getElementById('token-chart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'Other'],
        datasets: [{
          label: 'Token Arbitrage Frequency',
          data: [30, 25, 15, 12, 10, 8],
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
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
  }
  
  // Profit vs gas cost analysis chart
  if (document.getElementById('profit-gas-chart')) {
    const ctx = document.getElementById('profit-gas-chart').getContext('2d');
    new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Profit vs Gas Cost',
          data: [
            { x: 10, y: 0.8 },
            { x: 15, y: 1.2 },
            { x: 20, y: 1.5 },
            { x: 25, y: 1.1 },
            { x: 30, y: 1.8 },
            { x: 35, y: 0.9 },
            { x: 40, y: 2.0 },
            { x: 45, y: 1.3 },
            { x: 50, y: 2.2 }
          ],
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Gas Cost (Gwei)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Profit (%)'
            }
          }
        }
      }
    });
  }
  
  return true;
} 