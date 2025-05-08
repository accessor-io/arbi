export default {
  server: {
    port: 3000,
    host: 'localhost',
    ssl: false
  },

  arbitrage: {
    scanInterval: 60,
    maxSlippage: 0.5,
    minProfit: 0.1
  },

  execution: {
    maxConcurrent: 5,
    maxRetries: 3,
    retryDelay: 1000
  },

  monitoring: {
    enabled: true,
    interval: 300,
    alertThreshold: 5
  },

  analytics: {
    enabled: true,
    retentionDays: 30,
    maxMetrics: 10000
  },

  security: {
    blacklistEnabled: true,
    whitelistEnabled: false,
    minAmount: 0.01,
    maxAmount: 1000,
    maxSlippage: 0.5
  },

  gas: {
    maxPrice: 100,
    updateInterval: 60
  },

  notifications: {
    enabled: true,
    maxQueueSize: 1000,
    retryAttempts: 3,
    retryDelay: 1000,
    channels: [
      {
        type: 'email',
        enabled: true,
        config: {
          // Add email-specific configuration here
        }
      },
      {
        type: 'slack',
        enabled: true,
        config: {
          // Add Slack-specific configuration here
        }
      }
    ]
  }
}; 