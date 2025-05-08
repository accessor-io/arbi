import { logger } from '../../utils/logger.js';
import NotificationService from './NotificationService.js';
import TaskScheduler from '../utils/TaskScheduler.js';
import ConfigService from '../utils/ConfigService.js';

class MonitoringService {
  constructor(notificationService, taskScheduler, configService) {
    this.notificationService = notificationService;
    this.taskScheduler = taskScheduler;
    this.configService = configService;
    this.monitors = new Map();
    this.metrics = {
      opportunities: 0,
      executions: 0,
      errors: 0,
      lastUpdate: null
    };
  }

  async initialize() {
    try {
      const enabled = this.configService.get('monitoring.enabled', true);
      const interval = this.configService.get('monitoring.interval', 300);
      const alertThreshold = this.configService.get('monitoring.alertThreshold', 5);

      logger.info('Monitoring service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  async startMonitoring(monitorId, monitorFn, intervalSeconds) {
    try {
      if (this.monitors.has(monitorId)) {
        logger.warn(`Monitor ${monitorId} already exists`);
        return;
      }

      const taskId = await this.taskScheduler.scheduleTask(
        monitorId,
        async () => this._runMonitor(monitorId, monitorFn),
        intervalSeconds
      );

      this.monitors.set(monitorId, {
        taskId,
        status: 'running',
        lastRun: null,
        errorCount: 0
      });

      logger.info(`Started monitoring: ${monitorId}`);
    } catch (error) {
      logger.error(`Failed to start monitoring ${monitorId}:`, error);
      throw error;
    }
  }

  async stopMonitoring(monitorId) {
    try {
      const monitor = this.monitors.get(monitorId);
      if (!monitor) {
        logger.warn(`Monitor ${monitorId} not found`);
        return;
      }

      await this.taskScheduler.cancelTask(monitor.taskId);
      this.monitors.delete(monitorId);

      logger.info(`Stopped monitoring: ${monitorId}`);
    } catch (error) {
      logger.error(`Failed to stop monitoring ${monitorId}:`, error);
      throw error;
    }
  }

  async _runMonitor(monitorId, monitorFn) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) return;

    try {
      const alertThreshold = this.configService.get('monitoring.alertThreshold', 5);
      
      const result = await monitorFn();
      
      // Update metrics
      this.metrics.opportunities += result.opportunities || 0;
      this.metrics.executions += result.executions || 0;
      this.metrics.lastUpdate = Date.now();

      // Update monitor status
      monitor.lastRun = Date.now();
      monitor.lastResult = result;
      monitor.errorCount = 0;

      logger.debug(`Monitor ${monitorId} completed successfully`);
    } catch (error) {
      monitor.errorCount++;
      this.metrics.errors++;

      if (monitor.errorCount >= alertThreshold) {
        await this.notificationService.sendAlert({
          type: 'monitor_error',
          monitorId,
          error: error.message,
          errorCount: monitor.errorCount
        });
      }

      logger.error(`Monitor ${monitorId} failed:`, error);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeMonitors: this.monitors.size
    };
  }

  getMonitorStatus(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    return monitor;
  }

  async cleanup() {
    for (const [monitorId, monitor] of this.monitors) {
      await this.stopMonitoring(monitorId);
    }
    this.monitors.clear();
    this.metrics = {
      opportunities: 0,
      executions: 0,
      errors: 0,
      lastUpdate: null
    };
    logger.info('Monitoring service cleaned up');
  }
}

export default MonitoringService; 