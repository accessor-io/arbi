/**
 * Monitoring Service - Tracks system performance and health
 */
import { EventEmitter } from 'events';
import config from '../../config/config.js';

class MonitoringService extends EventEmitter {
  constructor(arbitrageService, executionService, priceService) {
    super();
    this.arbitrageService = arbitrageService;
    this.executionService = executionService;
    this.priceService = priceService;
    
    this.metrics = {
      opportunities: {
        total: 0,
        profitable: 0,
        executed: 0,
        failed: 0,
        averageProfit: 0
      },
      executions: {
        active: 0,
        completed: 0,
        failed: 0,
        averageExecutionTime: 0
      },
      prices: {
        lastUpdate: null,
        updateLatency: 0,
        failedUpdates: 0
      },
      system: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
    
    this.alerts = [];
    this.alertThresholds = {
      minProfitThreshold: config.monitoring.alertThresholds.minProfitThreshold,
      maxExecutionTime: config.monitoring.alertThresholds.maxExecutionTime,
      maxPriceLatency: config.monitoring.alertThresholds.maxPriceLatency,
      maxMemoryUsage: config.monitoring.alertThresholds.maxMemoryUsage,
      maxCpuUsage: config.monitoring.alertThresholds.maxCpuUsage
    };
    
    this.updateInterval = null;
    this.callbacks = {
      onAlert: [],
      onMetricsUpdate: []
    };
  }

  /**
   * Initialize the monitoring service
   */
  async initialize() {
    // Subscribe to service events
    this.arbitrageService.subscribe('onOpportunityFound', this.handleOpportunity.bind(this));
    this.arbitrageService.subscribe('onScanComplete', this.handleScanComplete.bind(this));
    
    this.executionService.subscribe('onExecutionStart', this.handleExecutionStart.bind(this));
    this.executionService.subscribe('onExecutionComplete', this.handleExecutionComplete.bind(this));
    this.executionService.subscribe('onExecutionError', this.handleExecutionError.bind(this));
    
    this.priceService.on('pricesUpdated', this.handlePriceUpdate.bind(this));
    this.priceService.on('error', this.handlePriceError.bind(this));
    
    // Start monitoring
    this.startMonitoring();
    
    console.log('Monitoring service initialized');
    return true;
  }

  /**
   * Start system monitoring
   */
  startMonitoring() {
    // Update metrics every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, config.monitoring.updateIntervalMs || 5000);
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    // Update uptime
    this.metrics.system.uptime = process.uptime();
    
    // Update memory usage
    const used = process.memoryUsage();
    this.metrics.system.memoryUsage = used.heapUsed / used.heapTotal;
    
    // Update CPU usage (requires external module)
    this.updateCpuUsage();
    
    // Check for alerts
    this.checkAlerts();
    
    // Notify listeners
    this.notifyListeners('onMetricsUpdate', this.metrics);
  }

  /**
   * Update CPU usage
   */
  async updateCpuUsage() {
    try {
      const startUsage = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);
      
      const totalTime = (endUsage.user + endUsage.system) / 1000000;
      this.metrics.system.cpuUsage = totalTime / 0.1; // Convert to percentage
    } catch (error) {
      console.error('Error updating CPU usage:', error);
    }
  }

  /**
   * Check for system alerts
   */
  checkAlerts() {
    // Check memory usage
    if (this.metrics.system.memoryUsage > this.alertThresholds.maxMemoryUsage) {
      this.createAlert('high_memory_usage', 'System memory usage is too high');
    }
    
    // Check CPU usage
    if (this.metrics.system.cpuUsage > this.alertThresholds.maxCpuUsage) {
      this.createAlert('high_cpu_usage', 'System CPU usage is too high');
    }
    
    // Check price update latency
    if (this.metrics.prices.lastUpdate) {
      const latency = Date.now() - this.metrics.prices.lastUpdate;
      if (latency > this.alertThresholds.maxPriceLatency) {
        this.createAlert('high_price_latency', 'Price updates are delayed');
      }
    }
  }

  /**
   * Create a new alert
   */
  createAlert(type, message) {
    const alert = {
      id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.push(alert);
    this.notifyListeners('onAlert', alert);
  }

  /**
   * Handle new arbitrage opportunities
   */
  handleOpportunity(opportunities) {
    this.metrics.opportunities.total += opportunities.length;
    
    const profitable = opportunities.filter(opp => 
      opp.profitPercent >= this.alertThresholds.minProfitThreshold
    );
    
    this.metrics.opportunities.profitable += profitable.length;
    
    // Update average profit
    if (profitable.length > 0) {
      const totalProfit = this.metrics.opportunities.averageProfit * 
        (this.metrics.opportunities.profitable - profitable.length);
      this.metrics.opportunities.averageProfit = 
        (totalProfit + profitable.reduce((sum, opp) => sum + opp.profitPercent, 0)) / 
        this.metrics.opportunities.profitable;
    }
  }

  /**
   * Handle scan completion
   */
  handleScanComplete(opportunities) {
    // Update metrics based on scan results
    this.metrics.opportunities.total += opportunities.length;
  }

  /**
   * Handle execution start
   */
  handleExecutionStart(execution) {
    this.metrics.executions.active++;
  }

  /**
   * Handle execution completion
   */
  handleExecutionComplete(execution) {
    this.metrics.executions.active--;
    this.metrics.executions.completed++;
    this.metrics.opportunities.executed++;
    
    // Update average execution time
    const executionTime = execution.endTime - execution.startTime;
    const totalTime = this.metrics.executions.averageExecutionTime * 
      (this.metrics.executions.completed - 1);
    this.metrics.executions.averageExecutionTime = 
      (totalTime + executionTime) / this.metrics.executions.completed;
  }

  /**
   * Handle execution error
   */
  handleExecutionError(execution) {
    this.metrics.executions.active--;
    this.metrics.executions.failed++;
    this.metrics.opportunities.failed++;
    
    this.createAlert('execution_error', 
      `Execution failed: ${execution.error}`);
  }

  /**
   * Handle price updates
   */
  handlePriceUpdate() {
    const now = Date.now();
    if (this.metrics.prices.lastUpdate) {
      this.metrics.prices.updateLatency = now - this.metrics.prices.lastUpdate;
    }
    this.metrics.prices.lastUpdate = now;
  }

  /**
   * Handle price update errors
   */
  handlePriceError(error) {
    this.metrics.prices.failedUpdates++;
    this.createAlert('price_update_error', 
      `Price update failed: ${error.message}`);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  getAlerts() {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  /**
   * Subscribe to service events
   */
  subscribe(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * Unsubscribe from service events
   */
  unsubscribe(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export default MonitoringService; 