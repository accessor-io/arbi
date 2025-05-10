import { logger } from '../utils/logger.js';
import RPCProvider from './RPCProvider.js';

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.info('Service container already initialized');
      return;
    }

    try {
      // Remove RPCProvider initialization
      this.isInitialized = true;
      logger.info('Service container initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize service container:', error);
      throw error;
    }
  }

  setService(name, service) {
    this.services.set(name, service);
  }

  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }

  async cleanup() {
    try {
      // Remove RPCProvider cleanup
      // Clear all services
      this.services.clear();
      this.isInitialized = false;
      logger.info('Service container cleaned up successfully');
    } catch (error) {
      logger.error('Error during service container cleanup:', error);
      throw error;
    }
  }
}

export default ServiceContainer; 