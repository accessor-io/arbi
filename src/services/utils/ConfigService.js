/**
 * Configuration Service
 * Manages application configuration with support for environment variables and defaults
 */
import { logger } from '../../utils/logger.js';
import config from '../../config/config.js';

class ConfigService {
  constructor() {
    this.config = config;
    this.env = process.env.NODE_ENV || 'development';
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  set(key, value) {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  getAll() {
    return { ...this.config };
  }

  async initialize() {
    try {
      // Validate required environment variables
      const requiredEnvVars = [];
      if (this.env === 'production') {
        requiredEnvVars.push(
          'RPC_URL',
          'BINANCE_API_KEY',
          'BINANCE_API_SECRET'
        );
      }

      const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingEnvVars.length > 0) {
        logger.warn(`Missing environment variables: ${missingEnvVars.join(', ')}`);
      }

      logger.info('Configuration service initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize configuration service:', error);
      throw error;
    }
  }
}

export default ConfigService; 