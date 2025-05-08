import TaskScheduler from '../services/TaskScheduler.js';
import { ethers } from 'ethers';

class AppOrchestrator {
  constructor(options = {}) {
    this.scheduler = new TaskScheduler();
    this.arbitrageService = options.arbitrageService;
    this.monitoringService = options.monitoringService;
    this.autoTrader = options.autoTrader;
    this.analyticsService = options.analyticsService;
    this.logger = options.logger;
    
    // Configuration
    this.scanInterval = options.scanInterval || 60000; // Default: scan every minute
    this.monitoringInterval = options.monitoringInterval || 300000; // Default: monitor every 5 minutes
    this.analyticsRefreshInterval = options.analyticsRefreshInterval || 3600000; // Default: refresh analytics hourly
  }
  
  start() {
    this.logger.info('Starting application orchestrator');
    
    // Start monitoring service if available
    if (this.monitoringService) {
      this.monitoringService.start();
    }
    
    // Schedule scanning for arbitrage opportunities
    if (this.arbitrageService) {
      this.scheduler.scheduleTask('arbitrage-scan', () => this.runArbitrageScan(), this.scanInterval);
      this.logger.info(`Scheduled arbitrage scanning every ${this.scanInterval / 1000} seconds`);
    }
    
    // Schedule analytics refresh
    if (this.analyticsService) {
      this.scheduler.scheduleTask('analytics-refresh', () => this.refreshAnalytics(), this.analyticsRefreshInterval);
      this.logger.info(`Scheduled analytics refresh every ${this.analyticsRefreshInterval / 60000} minutes`);
    }
    
    // Start with an immediate scan
    if (this.arbitrageService) {
      this.scheduler.scheduleOneTimeTask('initial-scan', () => this.runArbitrageScan(), 1000);
    }
    
    return this;
  }
  
  stop() {
    this.logger.info('Stopping application orchestrator');
    this.scheduler.clearAllTasks();
    
    if (this.monitoringService) {
      this.monitoringService.stop();
    }
    
    return this;
  }
  
  async runArbitrageScan() {
    try {
      this.logger.info('Scanning for arbitrage opportunities...');
      const opportunities = await this.arbitrageService.scanForOpportunities();
      this.logger.info(`Found ${opportunities.length} potential opportunities`);
      
      // If auto-trader is enabled, check for trades
      if (this.autoTrader && this.autoTrader.isRunning) {
        await this.autoTrader.checkForOpportunities();
      }
      
      return opportunities;
    } catch (error) {
      this.logger.error(`Error scanning for opportunities: ${error.message}`);
      return [];
    }
  }
  
  async refreshAnalytics() {
    if (!this.analyticsService) return;
    
    try {
      this.logger.info('Refreshing analytics data');
      const stats = this.analyticsService.generateStats();
      this.logger.info(`Updated analytics: ${stats.totalTrades} trades with ${stats.successfulTrades} successful`);
      return stats;
    } catch (error) {
      this.logger.error(`Error refreshing analytics: ${error.message}`);
    }
  }
  
  // Method to execute a single trade for testing
  async executeTestTrade(opportunityIndex, wallet, slippageTolerance = 0.5) {
    if (!this.arbitrageService) {
      this.logger.error('Arbitrage service not available');
      return { success: false, error: 'Arbitrage service not available' };
    }
    
    if (!wallet) {
      this.logger.error('Wallet not configured');
      return { success: false, error: 'Wallet not configured' };
    }
    
    try {
      const opportunities = this.arbitrageService.getOpportunities();
      
      if (!opportunities || opportunities.length === 0) {
        this.logger.error('No opportunities available');
        return { success: false, error: 'No opportunities available' };
      }
      
      if (opportunityIndex >= opportunities.length) {
        this.logger.error(`Invalid opportunity index: ${opportunityIndex}`);
        return { success: false, error: 'Invalid opportunity index' };
      }
      
      this.logger.info(`Executing test trade for opportunity ${opportunityIndex}`);
      const result = await this.arbitrageService.executeArbitrage(
        wallet, 
        opportunityIndex, 
        slippageTolerance
      );
      
      if (result.success && this.analyticsService) {
        this.analyticsService.recordTrade({
          timestamp: Date.now(),
          pair: `${opportunities[opportunityIndex].tokenA.symbol}-${opportunities[opportunityIndex].tokenB.symbol}`,
          buyExchange: opportunities[opportunityIndex].buy.exchange,
          sellExchange: opportunities[opportunityIndex].sell.exchange,
          amount: opportunities[opportunityIndex].tokenA.amount,
          profitPercent: opportunities[opportunityIndex].profitPercent,
          profitInEth: ethers.utils.formatEther(result.result.profit || '0'),
          success: true,
          txHash: {
            buy: result.result.buyTx,
            sell: result.result.sellTx
          }
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error executing test trade: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export default AppOrchestrator; 