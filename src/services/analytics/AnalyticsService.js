import { logger } from '../../utils/logger.js';

class AnalyticsService {
  constructor(configService) {
    this.configService = configService;
    this.metrics = {
      opportunities: [],
      executions: [],
      profits: [],
      losses: [],
      lastUpdate: null
    };
    this.analysisInterval = null;
  }

  async initialize() {
    try {
      const enabled = this.configService.get('analytics.enabled', true);
      const retentionDays = this.configService.get('analytics.retentionDays', 30);
      const maxMetrics = this.configService.get('analytics.maxMetrics', 10000);

      // Clean up old metrics based on retention period
      await this._cleanupOldMetrics(retentionDays);

      logger.info('Analytics service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics service:', error);
      throw error;
    }
  }

  async recordOpportunity(opportunity) {
    try {
      const maxMetrics = this.configService.get('analytics.maxMetrics', 10000);

      this.metrics.opportunities.push({
        id: opportunity.id,
        timestamp: Date.now(),
        profit: opportunity.profit,
        route: opportunity.route
      });

      // Trim metrics if exceeding max size
      if (this.metrics.opportunities.length > maxMetrics) {
        this.metrics.opportunities.shift();
      }

      this.metrics.lastUpdate = Date.now();
      logger.debug(`Recorded opportunity: ${opportunity.id}`);
    } catch (error) {
      logger.error('Failed to record opportunity:', error);
      throw error;
    }
  }

  async recordExecution(execution) {
    try {
      const maxMetrics = this.configService.get('analytics.maxMetrics', 10000);

      this.metrics.executions.push({
        id: execution.id,
        timestamp: Date.now(),
        success: execution.success,
        profit: execution.profit
      });

      // Categorize profit/loss
      if (execution.success) {
        if (execution.profit > 0) {
          this.metrics.profits.push(execution.profit);
        } else {
          this.metrics.losses.push(Math.abs(execution.profit));
        }
      }

      // Trim metrics if exceeding max size
      if (this.metrics.executions.length > maxMetrics) {
        this.metrics.executions.shift();
      }

      this.metrics.lastUpdate = Date.now();
      logger.debug(`Recorded execution: ${execution.id}`);
    } catch (error) {
      logger.error('Failed to record execution:', error);
      throw error;
    }
  }

  async analyzePerformance(timeframe = '24h') {
    try {
      const timeframeMs = this._getTimeframeMs(timeframe);
      const now = Date.now();
      const cutoff = now - timeframeMs;

      // Filter metrics within timeframe
      const recentExecutions = this.metrics.executions.filter(e => e.timestamp >= cutoff);
      const successfulExecutions = recentExecutions.filter(e => e.success);

      // Calculate statistics
      const totalExecutions = recentExecutions.length;
      const successfulCount = successfulExecutions.length;
      const totalProfit = this._calculateTotalProfit(successfulExecutions);
      const averageProfit = this._calculateAverageProfit(successfulExecutions);
      const winRate = this._calculateWinRate(recentExecutions);

      return {
        timeframe,
        totalExecutions,
        successfulExecutions: successfulCount,
        totalProfit,
        averageProfit,
        winRate,
        timestamp: now
      };
    } catch (error) {
      logger.error('Failed to analyze performance:', error);
      throw error;
    }
  }

  _getTimeframeMs(timeframe) {
    const units = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };
    const value = parseInt(timeframe);
    const unit = timeframe.slice(-1);
    return value * (units[unit] || units.h);
  }

  _calculateTotalProfit(executions) {
    return executions.reduce((sum, e) => sum + e.profit, 0);
  }

  _calculateAverageProfit(executions) {
    if (executions.length === 0) return 0;
    return this._calculateTotalProfit(executions) / executions.length;
  }

  _calculateWinRate(executions) {
    if (executions.length === 0) return 0;
    const wins = executions.filter(e => e.success && e.profit > 0).length;
    return (wins / executions.length) * 100;
  }

  async _cleanupOldMetrics(retentionDays) {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    this.metrics.opportunities = this.metrics.opportunities.filter(o => o.timestamp >= cutoff);
    this.metrics.executions = this.metrics.executions.filter(e => e.timestamp >= cutoff);
    
    logger.debug(`Cleaned up metrics older than ${retentionDays} days`);
  }

  async cleanup() {
    this.metrics = {
      opportunities: [],
      executions: [],
      profits: [],
      losses: [],
      lastUpdate: null
    };
    logger.info('Analytics service cleaned up');
  }
}

export default AnalyticsService; 