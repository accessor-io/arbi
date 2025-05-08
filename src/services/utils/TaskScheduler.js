import { logger } from '../../utils/logger.js';

class TaskScheduler {
  constructor() {
    this.tasks = new Map();
    this.timers = new Map();
  }

  async initialize() {
    try {
      // Initialize task scheduler
      logger.info('Task scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize task scheduler:', error);
      throw error;
    }
  }

  async scheduleTask(taskId, interval, callback) {
    try {
      if (this.tasks.has(taskId)) {
        throw new Error(`Task ${taskId} already exists`);
      }

      const task = {
        id: taskId,
        interval,
        callback,
        lastRun: null,
        nextRun: Date.now() + interval
      };

      this.tasks.set(taskId, task);
      
      const timer = setInterval(async () => {
        try {
          task.lastRun = Date.now();
          await callback();
          task.nextRun = Date.now() + interval;
        } catch (error) {
          logger.error(`Task ${taskId} execution failed:`, error);
        }
      }, interval);

      this.timers.set(taskId, timer);
      
      logger.info(`Task ${taskId} scheduled with interval ${interval}ms`);
      return task;
    } catch (error) {
      logger.error(`Failed to schedule task ${taskId}:`, error);
      throw error;
    }
  }

  async cancelTask(taskId) {
    try {
      const timer = this.timers.get(taskId);
      if (!timer) {
        throw new Error(`Task ${taskId} not found`);
      }

      clearInterval(timer);
      this.timers.delete(taskId);
      this.tasks.delete(taskId);
      
      logger.info(`Task ${taskId} cancelled`);
    } catch (error) {
      logger.error(`Failed to cancel task ${taskId}:`, error);
      throw error;
    }
  }

  getTaskStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    return {
      id: task.id,
      interval: task.interval,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isRunning: this.timers.has(taskId)
    };
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      interval: task.interval,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isRunning: this.timers.has(task.id)
    }));
  }

  async cleanup() {
    for (const [taskId] of this.timers) {
      await this.cancelTask(taskId);
    }
    logger.info('Task scheduler cleaned up');
  }
}

export default TaskScheduler; 