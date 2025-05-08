/**
 * Charts Module - Handles data visualization for the arbitrage dashboard
 */
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

export class ArbitrageCharts {
  constructor() {
    this.charts = new Map();
    this.chartColors = [
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 99, 132, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(255, 159, 64, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 205, 86, 0.7)',
      'rgba(201, 203, 207, 0.7)',
      'rgba(255, 99, 132, 0.7)'
    ];
  }

  /**
   * Initialize all charts on the dashboard
   */
  initializeCharts() {
    this.createExchangeComparisonChart();
    this.createProfitTrendChart();
    this.createTokenFrequencyChart();
    this.createGasPriceChart();
  }

  /**
   * Create a bar chart comparing exchanges and their opportunity counts
   */
  createExchangeComparisonChart(data = null) {
    // If no data is provided, use sample data
    if (!data) {
      data = {
        exchanges: ['Binance', 'Coinbase', 'Kraken', 'Huobi', 'KuCoin', 'Bitfinex'],
        opportunities: [12, 8, 5, 7, 4, 6]
      };
    }

    const ctx = document.getElementById('exchangeComparisonChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.has('exchangeComparison')) {
      this.charts.get('exchangeComparison').destroy();
    }

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.exchanges,
        datasets: [{
          label: 'Arbitrage Opportunities',
          data: data.opportunities,
          backgroundColor: this.chartColors,
          borderColor: this.chartColors.map(color => color.replace('0.7', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false
          },
          title: {
            display: true,
            text: 'Opportunities by Exchange'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Opportunities'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Exchange'
            }
          }
        }
      }
    });

    this.charts.set('exchangeComparison', chart);
    return chart;
  }

  /**
   * Create a line chart showing profit trends over time
   */
  createProfitTrendChart(data = null) {
    // If no data is provided, use sample data
    if (!data) {
      // Generate sample data for the last 7 days
      const labels = [];
      const values = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        values.push((Math.random() * 2 + 1).toFixed(2)); // Random profit between 1% and 3%
      }
      
      data = { labels, values };
    }

    const ctx = document.getElementById('profitTrendChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.has('profitTrend')) {
      this.charts.get('profitTrend').destroy();
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Average Profit %',
          data: data.values,
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return `Profit: ${context.parsed.y}%`;
              }
            }
          },
          title: {
            display: true,
            text: 'Profit Trend (7 Days)'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Profit %'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });

    this.charts.set('profitTrend', chart);
    return chart;
  }

  /**
   * Create a doughnut chart showing token frequency in arbitrage opportunities
   */
  createTokenFrequencyChart(data = null) {
    // If no data is provided, use sample data
    if (!data) {
      data = {
        labels: ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'Others'],
        values: [30, 25, 15, 10, 8, 12]
      };
    }

    const ctx = document.getElementById('tokenFrequencyChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.has('tokenFrequency')) {
      this.charts.get('tokenFrequency').destroy();
    }

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: this.chartColors,
          borderColor: this.chartColors.map(color => color.replace('0.7', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Token Distribution'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((context.parsed * 100) / total);
                return `${context.label}: ${percentage}%`;
              }
            }
          }
        }
      }
    });

    this.charts.set('tokenFrequency', chart);
    return chart;
  }

  /**
   * Create a gauge chart showing current gas prices
   */
  createGasPriceChart(currentGas = null) {
    // If no data is provided, use sample data
    if (!currentGas) {
      currentGas = Math.floor(Math.random() * 100) + 20; // Random between 20-120 Gwei
    }

    const ctx = document.getElementById('gasPriceChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.has('gasPrice')) {
      this.charts.get('gasPrice').destroy();
    }

    // Create a gauge chart for gas price
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Current Gas', 'Remaining'],
        datasets: [{
          data: [currentGas, 200 - currentGas], // Max 200 Gwei for scale
          backgroundColor: [
            this.getGasColorByPrice(currentGas),
            'rgba(220, 220, 220, 0.2)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        circumference: 180,
        rotation: 270,
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Current Gas Price (Gwei)'
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });

    // Add center text with current gas price
    const originalDraw = chart.draw;
    chart.draw = function() {
      originalDraw.apply(this, arguments);
      
      const width = chart.chartArea.right - chart.chartArea.left;
      const height = chart.chartArea.bottom - chart.chartArea.top;
      const ctx = chart.ctx;
      
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#333';
      ctx.fillText(`${currentGas}`, chart.chartArea.left + width / 2, chart.chartArea.top + height / 2);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('GWEI', chart.chartArea.left + width / 2, chart.chartArea.top + height / 2 + 20);
      ctx.restore();
    };

    this.charts.set('gasPrice', chart);
    return chart;
  }

  /**
   * Update all charts with new data
   */
  updateCharts(data) {
    if (data.exchangeData) {
      this.updateExchangeComparisonChart(data.exchangeData);
    }
    
    if (data.profitTrend) {
      this.updateProfitTrendChart(data.profitTrend);
    }
    
    if (data.tokenFrequency) {
      this.updateTokenFrequencyChart(data.tokenFrequency);
    }
    
    if (data.gasPrice) {
      this.updateGasPriceChart(data.gasPrice);
    }
  }

  /**
   * Update the exchange comparison chart
   */
  updateExchangeComparisonChart(data) {
    if (!this.charts.has('exchangeComparison')) {
      return this.createExchangeComparisonChart(data);
    }
    
    const chart = this.charts.get('exchangeComparison');
    chart.data.labels = data.exchanges;
    chart.data.datasets[0].data = data.opportunities;
    chart.update();
  }

  /**
   * Update the profit trend chart
   */
  updateProfitTrendChart(data) {
    if (!this.charts.has('profitTrend')) {
      return this.createProfitTrendChart(data);
    }
    
    const chart = this.charts.get('profitTrend');
    chart.data.labels = data.labels;
    chart.data.datasets[0].data = data.values;
    chart.update();
  }

  /**
   * Update the token frequency chart
   */
  updateTokenFrequencyChart(data) {
    if (!this.charts.has('tokenFrequency')) {
      return this.createTokenFrequencyChart(data);
    }
    
    const chart = this.charts.get('tokenFrequency');
    chart.data.labels = data.labels;
    chart.data.datasets[0].data = data.values;
    chart.update();
  }

  /**
   * Update the gas price chart
   */
  updateGasPriceChart(gasPrice) {
    if (!this.charts.has('gasPrice')) {
      return this.createGasPriceChart(gasPrice);
    }
    
    const chart = this.charts.get('gasPrice');
    chart.data.datasets[0].data = [gasPrice, 200 - gasPrice];
    chart.data.datasets[0].backgroundColor[0] = this.getGasColorByPrice(gasPrice);
    
    // Update center text
    const originalDraw = chart.draw;
    chart.draw = function() {
      originalDraw.apply(this, arguments);
      
      const width = chart.chartArea.right - chart.chartArea.left;
      const height = chart.chartArea.bottom - chart.chartArea.top;
      const ctx = chart.ctx;
      
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#333';
      ctx.fillText(`${gasPrice}`, chart.chartArea.left + width / 2, chart.chartArea.top + height / 2);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('GWEI', chart.chartArea.left + width / 2, chart.chartArea.top + height / 2 + 20);
      ctx.restore();
    };
    
    chart.update();
  }

  /**
   * Get color for gas price based on pricing tiers
   */
  getGasColorByPrice(gasPrice) {
    if (gasPrice < 30) {
      return 'rgba(75, 192, 192, 0.8)'; // Green for low
    } else if (gasPrice < 60) {
      return 'rgba(255, 205, 86, 0.8)'; // Yellow for medium
    } else if (gasPrice < 100) {
      return 'rgba(255, 159, 64, 0.8)'; // Orange for high
    } else {
      return 'rgba(255, 99, 132, 0.8)'; // Red for very high
    }
  }
}

// Export a singleton instance
export default new ArbitrageCharts(); 