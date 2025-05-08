class AutoTrader {
  constructor(arbitrageService, wallet, options = {}) {
    this.arbitrageService = arbitrageService;
    this.wallet = wallet;
    this.scheduler = options.scheduler || null;
    this.logger = options.logger || console;
    
    // Configuration
    this.minProfitPercent = options.minProfitPercent || 1.0;
    this.maxTradeAmount = options.maxTradeAmount || '1.0';
    this.slippageTolerance = options.slippageTolerance || 0.5;
    this.checkInterval = options.checkInterval || 60000; // Default: check every minute
    
    this.isRunning = false;
    this.taskId = 'auto-trader-check';
  }
  
  configure(config) {
    if (config.minProfitPercent !== undefined) {
      this.minProfitPercent = config.minProfitPercent;
    }
    
    if (config.maxTradeAmount !== undefined) {
      this.maxTradeAmount = config.maxTradeAmount;
    }
    
    if (config.slippageTolerance !== undefined) {
      this.slippageTolerance = config.slippageTolerance;
    }
    
    if (config.checkInterval !== undefined) {
      this.checkInterval = config.checkInterval;
      
      // Update scheduled task if running
      if (this.isRunning && this.scheduler) {
        this.stop();
        this.start();
      }
    }
    
    this.logger.info('AutoTrader configuration updated:', {
      minProfitPercent: this.minProfitPercent,
      maxTradeAmount: this.maxTradeAmount,
      slippageTolerance: this.slippageTolerance,
      checkInterval: this.checkInterval
    });
  }
  
  start() {
    if (this.isRunning) return this;
    
    this.isRunning = true;
    this.logger.info('Starting AutoTrader');
    
    // If we have a scheduler, use it, otherwise fall back to setTimeout
    if (this.scheduler) {
      this.scheduler.scheduleTask(this.taskId, () => this.checkForOpportunities(), this.checkInterval);
      // Run an immediate check
      this.scheduler.scheduleOneTimeTask('initial-check', () => this.checkForOpportunities(), 1000);
    } else {
      // Legacy method using setTimeout
      setTimeout(() => this.checkForOpportunities(), 1000);
    }
    
    return this;
  }
  
  stop() {
    if (!this.isRunning) return this;
    
    this.isRunning = false;
    this.logger.info('Stopping AutoTrader');
    
    // Clear task if using scheduler
    if (this.scheduler) {
      this.scheduler.clearTask(this.taskId);
    }
    
    return this;
  }
  
  async checkForOpportunities() {
    if (!this.isRunning) return;
    
    try {
      // Scan for opportunities
      const opportunities = await this.arbitrageService.scanForOpportunities();
      
      // Filter opportunities that meet our criteria
      const eligibleOpportunities = opportunities.filter(opp => {
        return (
          opp.profitPercent >= this.minProfitPercent &&
          parseFloat(opp.tokenA.amount) <= parseFloat(this.maxTradeAmount)
        );
      });
      
      // Execute the best opportunity if available
      if (eligibleOpportunities.length > 0) {
        const bestOpportunity = eligibleOpportunities[0];
        this.logger.info(`Executing automated trade for ${bestOpportunity.tokenA.symbol}/${bestOpportunity.tokenB.symbol} with expected profit ${bestOpportunity.profitPercent.toFixed(2)}%`);
        
        const index = this.arbitrageService.getOpportunities().indexOf(bestOpportunity);
        if (index !== -1) {
          const result = await this.arbitrageService.executeArbitrage(
            this.wallet,
            index,
            this.slippageTolerance
          );
          
          this.logger.info(`Automated trade result: ${result.success ? 'Success' : 'Failed'}`, result.success ? result.result : result.error);
        }
      }
    } catch (error) {
      this.logger.error('Error in automated trading:', error);
    }
    
    // Schedule next check if still running and not using scheduler
    if (this.isRunning && !this.scheduler) {
      setTimeout(() => this.checkForOpportunities(), this.checkInterval);
    }
  }
}

export default AutoTrader; 