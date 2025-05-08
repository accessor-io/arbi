import { logger } from '../../utils/logger.js';

class GasService {
  constructor(configService) {
    this.configService = configService;
    this.gasPriceHistory = [];
    this.maxHistorySize = 100;
    this.updateTimer = null;
  }

  async initialize() {
    try {
      const updateInterval = this.configService.get('gas.updateInterval', 60);
      const maxPrice = this.configService.get('gas.maxPrice', 100);

      await this._updateGasPrice();
      this.updateTimer = setInterval(
        () => this._updateGasPrice(),
        updateInterval * 1000
      );

      logger.info('Gas service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize gas service:', error);
      throw error;
    }
  }

  async getOptimalGasPrice() {
    try {
      const maxPrice = this.configService.get('gas.maxPrice', 100);
      const lastTenPrices = this.gasPriceHistory.slice(-10);
      
      if (lastTenPrices.length === 0) {
        return await this._fetchCurrentGasPrice();
      }

      const averagePrice = lastTenPrices.reduce((sum, price) => sum + price, 0) / lastTenPrices.length;
      const optimalPrice = Math.min(averagePrice * 1.05, maxPrice); // Add 5% buffer

      logger.debug(`Calculated optimal gas price: ${optimalPrice}`);
      return optimalPrice;
    } catch (error) {
      logger.error('Failed to get optimal gas price:', error);
      throw error;
    }
  }

  async _updateGasPrice() {
    try {
      const currentPrice = await this._fetchCurrentGasPrice();
      this.gasPriceHistory.push(currentPrice);

      if (this.gasPriceHistory.length > this.maxHistorySize) {
        this.gasPriceHistory.shift();
      }

      logger.debug(`Updated gas price: ${currentPrice}`);
    } catch (error) {
      logger.error('Failed to update gas price:', error);
    }
  }

  async _fetchCurrentGasPrice() {
    // TODO: Implement actual gas price fetching from blockchain
    return 50; // Mock value for now
  }

  getGasPriceHistory() {
    return [...this.gasPriceHistory];
  }

  async cleanup() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.gasPriceHistory = [];
    logger.info('Gas service cleaned up');
  }
}

export default GasService; 