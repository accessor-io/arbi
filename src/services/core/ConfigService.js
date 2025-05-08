import { logger } from '../../utils/logger.js';
import defaultConfig from '../../config.example.js';

class ConfigService {
  constructor() {
    this.config = new Map();
    this.env = process.env.NODE_ENV || 'development';
  }

  async initialize() {
    try {
      // Load default configuration
      this._loadDefaultConfig();

      // Load environment-specific configuration
      this._loadEnvConfig();

      // Validate configuration
      await this._validateConfig();

      logger.info('Configuration service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize configuration service:', error);
      throw error;
    }
  }

  _loadDefaultConfig() {
    this._loadConfigObject('', defaultConfig);
  }

  _loadConfigObject(prefix, obj) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this._loadConfigObject(fullKey, value);
      } else {
        this.config.set(fullKey, value);
      }
    }
  }

  _loadEnvConfig() {
    // Override with environment-specific values
    const envConfig = {
      development: {
        'server.port': 3000,
        'arbitrage.minProfit': 0.05
      },
      staging: {
        'server.port': 3001,
        'arbitrage.minProfit': 0.1
      },
      production: {
        'server.port': 3002,
        'arbitrage.minProfit': 0.2,
        'security.whitelistEnabled': true
      }
    };

    const currentEnvConfig = envConfig[this.env] || {};
    for (const [key, value] of Object.entries(currentEnvConfig)) {
      this.config.set(key, value);
    }

    // Override with environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('ARBI_')) {
        const configKey = key
          .replace('ARBI_', '')
          .toLowerCase()
          .replace(/_/g, '.');
        this.config.set(configKey, this._parseEnvValue(value));
      }
    }
  }

  _parseEnvValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value) && value !== '') return Number(value);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async _validateConfig() {
    const requiredConfigs = [
      'server.port',
      'arbitrage.scanInterval',
      'arbitrage.maxSlippage',
      'arbitrage.minProfit',
      'monitoring.enabled',
      'analytics.enabled',
      'security.blacklistEnabled',
      'notifications.enabled'
    ];

    for (const key of requiredConfigs) {
      if (!this.config.has(key)) {
        throw new Error(`Missing required configuration: ${key}`);
      }
    }
  }

  get(key, defaultValue = null) {
    return this.config.get(key) ?? defaultValue;
  }

  set(key, value) {
    this.config.set(key, value);
  }

  getAll() {
    return Object.fromEntries(this.config);
  }

  async cleanup() {
    this.config.clear();
    logger.info('Configuration service cleaned up');
  }
}

export default ConfigService; 