import TaskScheduler from '../TaskScheduler.js';

describe('TaskScheduler', () => {
  let taskScheduler;

  beforeEach(() => {
    taskScheduler = new TaskScheduler();
  });

  afterEach(async () => {
    await taskScheduler.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await taskScheduler.initialize();
      expect(taskScheduler.tasks.size).toBe(0);
    });
  });

  describe('scheduleTask', () => {
    beforeEach(async () => {
      await taskScheduler.initialize();
    });

    it('should schedule a task with interval', async () => {
      jest.useFakeTimers();

      const taskId = 'test-task';
      const taskFn = jest.fn();
      const interval = 60;

      await taskScheduler.scheduleTask(taskId, taskFn, interval);

      expect(taskScheduler.tasks.has(taskId)).toBe(true);
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), interval * 1000);

      // Fast-forward time and verify task execution
      jest.advanceTimersByTime(interval * 1000);
      expect(taskFn).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should not schedule duplicate tasks', async () => {
      const taskId = 'test-task';
      const taskFn = jest.fn();
      const interval = 60;

      await taskScheduler.scheduleTask(taskId, taskFn, interval);
      await expect(taskScheduler.scheduleTask(taskId, taskFn, interval))
        .rejects.toThrow('Task already exists');
    });

    it('should handle task execution errors', async () => {
      jest.useFakeTimers();

      const taskId = 'error-task';
      const taskFn = jest.fn().mockRejectedValue(new Error('Task error'));
      const interval = 60;

      await taskScheduler.scheduleTask(taskId, taskFn, interval);

      // Fast-forward time and verify error handling
      jest.advanceTimersByTime(interval * 1000);
      expect(taskFn).toHaveBeenCalled();
      expect(taskScheduler.tasks.has(taskId)).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('cancelTask', () => {
    beforeEach(async () => {
      await taskScheduler.initialize();
    });

    it('should cancel a scheduled task', async () => {
      const taskId = 'test-task';
      const taskFn = jest.fn();
      const interval = 60;

      await taskScheduler.scheduleTask(taskId, taskFn, interval);
      await taskScheduler.cancelTask(taskId);

      expect(taskScheduler.tasks.has(taskId)).toBe(false);
    });

    it('should handle non-existent task cancellation', async () => {
      await expect(taskScheduler.cancelTask('non-existent'))
        .rejects.toThrow('Task not found');
    });
  });

  describe('getAllTasks', () => {
    beforeEach(async () => {
      await taskScheduler.initialize();
    });

    it('should return all scheduled tasks', async () => {
      const tasks = [
        { id: 'task1', fn: jest.fn(), interval: 60 },
        { id: 'task2', fn: jest.fn(), interval: 120 }
      ];

      for (const task of tasks) {
        await taskScheduler.scheduleTask(task.id, task.fn, task.interval);
      }

      const allTasks = taskScheduler.getAllTasks();
      expect(allTasks.length).toBe(tasks.length);
      expect(allTasks.map(t => t.id)).toEqual(tasks.map(t => t.id));
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await taskScheduler.initialize();
    });

    it('should cancel all tasks on cleanup', async () => {
      const tasks = [
        { id: 'task1', fn: jest.fn(), interval: 60 },
        { id: 'task2', fn: jest.fn(), interval: 120 }
      ];

      for (const task of tasks) {
        await taskScheduler.scheduleTask(task.id, task.fn, task.interval);
      }

      await taskScheduler.cleanup();
      expect(taskScheduler.tasks.size).toBe(0);
    });

    it('should handle cleanup with no tasks', async () => {
      await taskScheduler.cleanup();
      expect(taskScheduler.tasks.size).toBe(0);
    });
  });
}); 