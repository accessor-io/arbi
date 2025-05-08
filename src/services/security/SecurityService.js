import { logger } from '../../utils/logger.js';

class SecurityService {
  constructor(configService) {
    this.configService = configService;
    this.securityChecks = new Map();
    this.blacklist = new Set();
    this.whitelist = new Set();
  }

  async initialize() {
    try {
      const blacklistEnabled = this.configService.get('security.blacklistEnabled', true);
      const whitelistEnabled = this.configService.get('security.whitelistEnabled', false);

      // Load blacklist and whitelist from storage
      await this._loadLists();

      // Initialize security checks
      this._initializeSecurityChecks();

      logger.info('Security service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize security service:', error);
      throw error;
    }
  }

  async validateTrade(trade) {
    try {
      const blacklistEnabled = this.configService.get('security.blacklistEnabled', true);
      const whitelistEnabled = this.configService.get('security.whitelistEnabled', false);

      // Check blacklist if enabled
      if (blacklistEnabled) {
        const blacklisted = await this._checkBlacklist(trade);
        if (blacklisted) {
          throw new Error('Trade involves blacklisted addresses');
        }
      }

      // Check whitelist if enabled
      if (whitelistEnabled) {
        const whitelisted = await this._checkWhitelist(trade);
        if (!whitelisted) {
          throw new Error('Trade involves non-whitelisted addresses');
        }
      }

      // Validate amounts
      await this._validateAmounts(trade);

      // Check slippage
      await this._checkSlippage(trade);

      return true;
    } catch (error) {
      logger.error('Trade validation failed:', error);
      throw error;
    }
  }

  async _loadLists() {
    // TODO: Implement loading blacklist and whitelist from storage
    logger.debug('Loading security lists');
  }

  _initializeSecurityChecks() {
    this.securityChecks.set('blacklist', this._checkBlacklist.bind(this));
    this.securityChecks.set('whitelist', this._checkWhitelist.bind(this));
    this.securityChecks.set('amounts', this._validateAmounts.bind(this));
    this.securityChecks.set('slippage', this._checkSlippage.bind(this));
  }

  async _checkBlacklist(trade) {
    const addresses = this._extractAddresses(trade);
    for (const address of addresses) {
      if (this.blacklist.has(address)) {
        return true;
      }
    }
    return false;
  }

  async _checkWhitelist(trade) {
    const addresses = this._extractAddresses(trade);
    for (const address of addresses) {
      if (!this.whitelist.has(address)) {
        return false;
      }
    }
    return true;
  }

  async _validateAmounts(trade) {
    const minAmount = this.configService.get('security.minAmount', 0.01);
    const maxAmount = this.configService.get('security.maxAmount', 1000);

    if (trade.amount < minAmount || trade.amount > maxAmount) {
      throw new Error(`Trade amount ${trade.amount} is outside allowed range`);
    }
  }

  async _checkSlippage(trade) {
    const maxSlippage = this.configService.get('security.maxSlippage', 0.5);
    if (trade.slippage > maxSlippage) {
      throw new Error(`Slippage ${trade.slippage}% exceeds maximum allowed ${maxSlippage}%`);
    }
  }

  _extractAddresses(trade) {
    const addresses = new Set();
    if (trade.from) addresses.add(trade.from);
    if (trade.to) addresses.add(trade.to);
    if (trade.token) addresses.add(trade.token);
    return Array.from(addresses);
  }

  async addToBlacklist(address) {
    this.blacklist.add(address);
    // TODO: Persist to storage
    logger.info(`Added address to blacklist: ${address}`);
  }

  async addToWhitelist(address) {
    this.whitelist.add(address);
    // TODO: Persist to storage
    logger.info(`Added address to whitelist: ${address}`);
  }

  async removeFromBlacklist(address) {
    this.blacklist.delete(address);
    // TODO: Persist to storage
    logger.info(`Removed address from blacklist: ${address}`);
  }

  async removeFromWhitelist(address) {
    this.whitelist.delete(address);
    // TODO: Persist to storage
    logger.info(`Removed address from whitelist: ${address}`);
  }

  async cleanup() {
    this.securityChecks.clear();
    this.blacklist.clear();
    this.whitelist.clear();
    logger.info('Security service cleaned up');
  }
}

export default SecurityService; 