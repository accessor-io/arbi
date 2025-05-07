import { logger } from '../../utils/logger.js';
import ConfigService from '../utils/ConfigService.js';
import GasService from '../utils/GasService.js';
import TaskScheduler from '../utils/TaskScheduler.js';
import ArbitrageService from '../arbitrage/ArbitrageService.js';
import ExecutionService from '../arbitrage/ExecutionService.js';
import MonitoringService from '../monitoring/MonitoringService.js';
import NotificationService from '../monitoring/NotificationService.js';
import AnalyticsService from '../analytics/AnalyticsService.js';
import SecurityService from '../security/SecurityService.js';

class ServiceContainer {
  constructor() {
    this.services = new Map();
  }

  async initialize() {
    try {
      // Initialize config service first
      const configService = new ConfigService();
      await configService.initialize();
      this.services.set('config', configService);

      // Initialize utility services
      const gasService = new GasService(configService);
      await gasService.initialize();
      this.services.set('gas', gasService);

      const taskScheduler = new TaskScheduler();
      await taskScheduler.initialize();
      this.services.set('scheduler', taskScheduler);

      // Initialize security service
      const securityService = new SecurityService(configService);
      await securityService.initialize();
      this.services.set('security', securityService);

      // Initialize execution service
      const executionService = new ExecutionService(
        this.get('gas'),
        this.get('security'),
        this.get('config')
      );
      await executionService.initialize();
      this.services.set('execution', executionService);

      // Initialize arbitrage service
      const arbitrageService = new ArbitrageService(
        this.get('execution'),
        this.get('config')
      );
      await arbitrageService.initialize();
      this.services.set('arbitrage', arbitrageService);

      // Initialize monitoring services
      const notificationService = new NotificationService();
      await notificationService.initialize();
      this.services.set('notification', notificationService);

      const monitoringService = new MonitoringService(
        this.get('notification'),
        this.get('scheduler')
      );
      await monitoringService.initialize();
      this.services.set('monitoring', monitoringService);

      // Initialize analytics service
      const analyticsService = new AnalyticsService();
      await analyticsService.initialize();
      this.services.set('analytics', analyticsService);

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      await this.cleanup();
      throw error;
    }
  }

  get(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service;
  }

  async cleanup() {
    for (const [name, service] of this.services) {
      try {
        await service.cleanup();
        logger.info(`Service cleaned up: ${name}`);
      } catch (error) {
        logger.error(`Failed to cleanup service ${name}:`, error);
      }
    }
    this.services.clear();
  }
}

export default ServiceContainer; 