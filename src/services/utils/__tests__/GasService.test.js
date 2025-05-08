import GasService from '../GasService.js';
import ConfigService from '../../core/ConfigService.js';

jest.mock('../../core/ConfigService.js');

describe('GasService', () => {
  let gasService;
  let configService;

  beforeEach(() => {
    configService = new ConfigService();
    configService.get.mockImplementation((key, defaultValue) => {
      const config = {
        'gas.updateInterval': 60,
        'gas.maxPrice': 100
      };
      return config[key] ?? defaultValue;
    });

    gasService = new GasService(configService);
  });

  afterEach(async () => {
    await gasService.cleanup();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      await gasService.initialize();
      expect(configService.get).toHaveBeenCalledWith('gas.updateInterval', 60);
      expect(configService.get).toHaveBeenCalledWith('gas.maxPrice', 100);
    });

    it('should start gas price updates', async () => {
      jest.useFakeTimers();
      await gasService.initialize();

      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);

      jest.useRealTimers();
    });

    it('should handle initialization errors', async () => {
      configService.get.mockImplementation(() => {
        throw new Error('Config error');
      });

      await expect(gasService.initialize()).rejects.toThrow('Config error');
    });
  });

  describe('getOptimalGasPrice', () => {
    beforeEach(async () => {
      await gasService.initialize();
    });

    it('should return current gas price if no history', async () => {
      const gasPrice = await gasService.getOptimalGasPrice();
      expect(gasPrice).toBeDefined();
      expect(typeof gasPrice).toBe('number');
    });

    it('should calculate optimal gas price from history', async () => {
      // Add some gas prices to history
      for (let i = 0; i < 5; i++) {
        await gasService._updateGasPrice();
      }

      const gasPrice = await gasService.getOptimalGasPrice();
      expect(gasPrice).toBeDefined();
      expect(typeof gasPrice).toBe('number');
      expect(gasPrice).toBeLessThanOrEqual(100); // maxPrice
    });

    it('should respect max gas price', async () => {
      configService.get.mockReturnValue(50); // Lower max price

      const gasPrice = await gasService.getOptimalGasPrice();
      expect(gasPrice).toBeLessThanOrEqual(50);
    });
  });

  describe('_updateGasPrice', () => {
    beforeEach(async () => {
      await gasService.initialize();
    });

    it('should update gas price history', async () => {
      await gasService._updateGasPrice();
      expect(gasService.gasPriceHistory.length).toBe(1);
    });

    it('should maintain max history size', async () => {
      // Add more prices than maxHistorySize
      for (let i = 0; i < 150; i++) {
        await gasService._updateGasPrice();
      }

      expect(gasService.gasPriceHistory.length).toBe(100);
    });

    it('should handle update errors', async () => {
      const mockFetchGasPrice = jest.spyOn(gasService, '_fetchCurrentGasPrice');
      mockFetchGasPrice.mockRejectedValue(new Error('Network error'));

      await gasService._updateGasPrice();
      expect(gasService.gasPriceHistory.length).toBe(0);
    });
  });

  describe('getGasPriceHistory', () => {
    beforeEach(async () => {
      await gasService.initialize();
    });

    it('should return copy of gas price history', async () => {
      await gasService._updateGasPrice();
      const history = gasService.getGasPriceHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history).not.toBe(gasService.gasPriceHistory);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await gasService.initialize();
    });

    it('should clear update timer and history', async () => {
      await gasService._updateGasPrice();
      expect(gasService.gasPriceHistory.length).toBeGreaterThan(0);

      await gasService.cleanup();
      expect(gasService.updateTimer).toBeNull();
      expect(gasService.gasPriceHistory.length).toBe(0);
    });
  });
}); 