import ServiceContainer from '../ServiceContainer.js';
import ConfigService from '../ConfigService.js';
import GasService from '../../utils/GasService.js';
import TaskScheduler from '../../utils/TaskScheduler.js';
import ArbitrageService from '../../arbitrage/ArbitrageService.js';
import ExecutionService from '../../arbitrage/ExecutionService.js';
import MonitoringService from '../../monitoring/MonitoringService.js';
import NotificationService from '../../monitoring/NotificationService.js';
import AnalyticsService from '../../analytics/AnalyticsService.js';
import SecurityService from '../../security/SecurityService.js';

jest.mock('../ConfigService.js');
jest.mock('../../utils/GasService.js');
jest.mock('../../utils/TaskScheduler.js');
jest.mock('../../arbitrage/ArbitrageService.js');
jest.mock('../../arbitrage/ExecutionService.js');
jest.mock('../../monitoring/MonitoringService.js');
jest.mock('../../monitoring/NotificationService.js');
jest.mock('../../analytics/AnalyticsService.js');
jest.mock('../../security/SecurityService.js');

describe('ServiceContainer', () => {
  let container;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(async () => {
    await container.cleanup();
  });

  describe('initialization', () => {
    it('should initialize all services in correct order', async () => {
      await container.initialize();

      // Verify services were initialized in correct order
      expect(ConfigService).toHaveBeenCalled();
      expect(GasService).toHaveBeenCalled();
      expect(TaskScheduler).toHaveBeenCalled();
      expect(SecurityService).toHaveBeenCalled();
      expect(ExecutionService).toHaveBeenCalled();
      expect(ArbitrageService).toHaveBeenCalled();
      expect(NotificationService).toHaveBeenCalled();
      expect(MonitoringService).toHaveBeenCalled();
      expect(AnalyticsService).toHaveBeenCalled();

      // Verify service dependencies
      const executionService = container.get('execution');
      expect(executionService.gasService).toBeDefined();
      expect(executionService.securityService).toBeDefined();

      const arbitrageService = container.get('arbitrage');
      expect(arbitrageService.executionService).toBeDefined();
      expect(arbitrageService.configService).toBeDefined();

      const monitoringService = container.get('monitoring');
      expect(monitoringService.notificationService).toBeDefined();
      expect(monitoringService.taskScheduler).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      ConfigService.mockImplementation(() => {
        throw error;
      });

      await expect(container.initialize()).rejects.toThrow(error);
      expect(container.services.size).toBe(0);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await container.initialize();
    });

    it('should return requested service', () => {
      expect(container.get('config')).toBeDefined();
      expect(container.get('gas')).toBeDefined();
      expect(container.get('scheduler')).toBeDefined();
      expect(container.get('security')).toBeDefined();
      expect(container.get('execution')).toBeDefined();
      expect(container.get('arbitrage')).toBeDefined();
      expect(container.get('notification')).toBeDefined();
      expect(container.get('monitoring')).toBeDefined();
      expect(container.get('analytics')).toBeDefined();
    });

    it('should throw error for non-existent service', () => {
      expect(() => container.get('nonexistent')).toThrow('Service not found');
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await container.initialize();
    });

    it('should cleanup all services', async () => {
      await container.cleanup();

      // Verify all services were cleaned up
      const services = [
        'config',
        'gas',
        'scheduler',
        'security',
        'execution',
        'arbitrage',
        'notification',
        'monitoring',
        'analytics'
      ];

      for (const serviceName of services) {
        const service = container.get(serviceName);
        expect(service.cleanup).toHaveBeenCalled();
      }

      expect(container.services.size).toBe(0);
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      const configService = container.get('config');
      configService.cleanup.mockRejectedValue(error);

      await container.cleanup();
      expect(container.services.size).toBe(0);
    });
  });
}); 