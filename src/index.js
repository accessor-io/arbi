/**
 * Entry point for the Crypto Arbitrage application
 */
import { logger } from './utils/logger.js';
import ServiceContainer from './services/core/ServiceContainer.js';

class ArbitrageApp {
  constructor() {
    this.container = new ServiceContainer();
    this.isInitialized = false;
    this.isRunning = false;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.info('Application already initialized');
      return;
    }

    try {
      await this.container.initialize();
      this.isInitialized = true;
      logger.info('Application initialized successfully');

      // Handle shutdown signals
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      logger.info('Application already running');
      return;
    }

    try {
      const arbitrageService = this.container.get('arbitrage');
      await arbitrageService.startScanning();
      this.isRunning = true;
      logger.info('Application started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down application...');
    try {
      await this.container.cleanup();
      this.isRunning = false;
      this.isInitialized = false;
      logger.info('Application shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      initialized: this.isInitialized,
      services: Array.from(this.container.services.keys()),
      metrics: this.container.get('monitoring')?.getMetrics() || {}
    };
  }
}

// Create and export the app instance
const app = new ArbitrageApp();
export default app;

app.start(); 