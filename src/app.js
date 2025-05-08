/**
 * Main Crypto Arbitrage Application
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import { ethers } from 'ethers';
import PriceService from './services/exchange/priceService.js';
import ArbitrageService from './services/core/arbitrageService.js';
import ExecutionService from './services/core/executionService.js';
import MonitoringService from './services/core/monitoringService.js';
import config from './config/config.js';

// Import routes
import dexRoutes from './api/dex.js';
import arbitrageRoutes from './api/arbitrage.js';
import analyticsRoutes from './api/analytics.js';

// Create express app
const expressApp = express();

// Middleware
expressApp.use(cors());
expressApp.use(express.json());
expressApp.use(express.static(path.join(__dirname, 'ui/public')));

// API Routes
expressApp.use('/api/dex', dexRoutes);
expressApp.use('/api/arbitrage', arbitrageRoutes);
expressApp.use('/api/analytics', analyticsRoutes);

// Serve static files
expressApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui/public/index.html'));
});

expressApp.get('/dex-explorer', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui/public/dex-explorer.html'));
});

// Error handling
expressApp.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message });
});

class ArbitrageApp {
  constructor() {
    // Initialize services
    this.priceService = new PriceService();
    this.arbitrageService = new ArbitrageService(this.priceService);
    this.executionService = new ExecutionService(this.arbitrageService, this.priceService);
    this.monitoringService = new MonitoringService(this.arbitrageService, this.executionService, this.priceService);
    
    this.services = {
      price: this.priceService,
      arbitrage: this.arbitrageService,
      execution: this.executionService,
      monitoring: this.monitoringService
    };
    
    this.isRunning = false;
    this.initialized = false;
    this.expressApp = expressApp;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    if (this.initialized) {
      console.log('Application already initialized');
      return;
    }

    try {
      console.log('Initializing arbitrage application...');
      
      // Initialize all services in the correct order
      await this.services.price.initialize();
      await this.services.arbitrage.initialize();
      await this.services.execution.initialize();
      await this.services.monitoring.initialize();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.initialized = true;
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Error initializing application:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Handle price updates
    this.services.price.on('pricesUpdated', (prices) => {
      console.log('Prices updated:', prices.size, 'pairs');
    });

    // Handle price movements
    this.services.price.on('priceMovement', (data) => {
      console.log('Significant price movement detected:', data);
    });

    // Handle arbitrage opportunities
    this.services.arbitrage.subscribe('onOpportunityFound', (opportunities) => {
      console.log('Arbitrage opportunities found:', opportunities.length);
      opportunities.forEach(opp => {
        console.log(`Opportunity: ${opp.pair} - ${opp.profitPercent}% profit`);
      });
    });

    // Handle execution events
    this.services.execution.subscribe('onExecutionStart', (execution) => {
      console.log('Execution started:', execution.id);
    });

    this.services.execution.subscribe('onExecutionComplete', (execution) => {
      console.log('Execution completed:', execution.id, 'Profit:', execution.actualProfit);
    });

    this.services.execution.subscribe('onExecutionError', (execution) => {
      console.error('Execution failed:', execution.id, execution.error);
    });

    // Handle monitoring alerts
    this.services.monitoring.subscribe('onAlert', (alert) => {
      console.log('System alert:', alert.message);
    });
  }

  /**
   * Start the application
   */
  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      console.log('Application is already running');
      return;
    }

    try {
      console.log('Starting arbitrage application...');
      
      // Start arbitrage scanning
      this.services.arbitrage.startAutomaticScanning();
      
      // Start express server
      const PORT = process.env.PORT || 3000;
      this.expressApp.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        
        // Initialize providers for each supported chain
        const supportedChains = {
          '1': { name: 'Ethereum Mainnet', rpcUrl: process.env.ETH_RPC_URL },
          '56': { name: 'BSC', rpcUrl: process.env.BSC_RPC_URL },
          '137': { name: 'Polygon', rpcUrl: process.env.POLYGON_RPC_URL },
          '42161': { name: 'Arbitrum', rpcUrl: process.env.ARBITRUM_RPC_URL },
          '10': { name: 'Optimism', rpcUrl: process.env.OPTIMISM_RPC_URL }
        };
        
        // Test connections
        Object.entries(supportedChains).forEach(async ([chainId, config]) => {
          try {
            const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
            const network = await provider.getNetwork();
            console.log(`Connected to ${config.name} (Chain ID: ${network.chainId})`);
          } catch (error) {
            console.error(`Failed to connect to ${config.name}:`, error.message);
          }
        });
      });
      
      this.isRunning = true;
      console.log('Application started successfully');
    } catch (error) {
      console.error('Error starting application:', error);
      throw error;
    }
  }

  /**
   * Stop the application
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Application is not running');
      return;
    }

    try {
      console.log('Stopping arbitrage application...');
      
      // Stop services in reverse order
      this.services.arbitrage.stopAutomaticScanning();
      this.services.monitoring.stop();
      this.services.price.stop();
      
      this.isRunning = false;
      console.log('Application stopped successfully');
    } catch (error) {
      console.error('Error stopping application:', error);
      throw error;
    }
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      initialized: this.initialized,
      metrics: this.services.monitoring.getMetrics(),
      alerts: this.services.monitoring.getAlerts(),
      tokens: this.services.price.getAllTokens().map(token => ({
        symbol: token.symbol,
        name: token.name,
        lastUpdated: token.lastUpdated,
        prices: Object.fromEntries(token.prices)
      }))
    };
  }

  /**
   * Update application settings
   */
  updateSettings(settings) {
    // Update arbitrage service settings
    if (settings.arbitrage) {
      this.services.arbitrage.updateSettings(settings.arbitrage);
    }
    
    // Update execution service settings
    if (settings.execution) {
      this.services.execution.updateSettings(settings.execution);
    }
  }
}

// Create and export a single instance
const app = new ArbitrageApp();
export default app; 