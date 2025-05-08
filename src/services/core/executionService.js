/**
 * Execution Service - Handles the execution of arbitrage opportunities
 */
import { EventEmitter } from 'events';
import config from '../../config/config.js';

class ExecutionService extends EventEmitter {
  constructor(arbitrageService, priceService) {
    super();
    this.arbitrageService = arbitrageService;
    this.priceService = priceService;
    this.activeExecutions = new Map();
    this.executionHistory = [];
    this.settings = {
      maxConcurrentExecutions: config.execution.maxConcurrentExecutions,
      minConfirmationBlocks: config.execution.minConfirmationBlocks,
      maxExecutionTime: config.execution.maxExecutionTime,
      slippageTolerance: config.execution.slippageTolerance,
      retryAttempts: config.execution.retryAttempts,
      retryDelay: config.execution.retryDelay
    };
    this.callbacks = {
      onExecutionStart: [],
      onExecutionComplete: [],
      onExecutionError: [],
      onExecutionUpdate: []
    };
  }

  /**
   * Initialize the execution service
   */
  async initialize() {
    // Subscribe to arbitrage opportunities
    this.arbitrageService.subscribe('onOpportunityFound', this.handleOpportunity.bind(this));
    
    // Subscribe to price updates
    this.priceService.on('pricesUpdated', this.handlePriceUpdate.bind(this));
    
    console.log('Execution service initialized');
    return true;
  }

  /**
   * Handle new arbitrage opportunities
   */
  async handleOpportunity(opportunities) {
    for (const opportunity of opportunities) {
      // Check if we can execute this opportunity
      if (await this.canExecute(opportunity)) {
        this.executeOpportunity(opportunity);
      }
    }
  }

  /**
   * Handle price updates
   */
  handlePriceUpdate(prices) {
    // Update active executions with new prices
    for (const [id, execution] of this.activeExecutions.entries()) {
      this.updateExecutionPrices(id, execution, prices);
    }
  }

  /**
   * Check if an opportunity can be executed
   */
  async canExecute(opportunity) {
    // Check if we have too many active executions
    if (this.activeExecutions.size >= this.settings.maxConcurrentExecutions) {
      return false;
    }

    // Check if opportunity is still valid
    const currentPrices = await this.getCurrentPrices(opportunity);
    if (!this.isOpportunityValid(opportunity, currentPrices)) {
      return false;
    }

    // Check if we have enough balance
    if (!await this.hasEnoughBalance(opportunity)) {
      return false;
    }

    return true;
  }

  /**
   * Execute an arbitrage opportunity
   */
  async executeOpportunity(opportunity) {
    const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create execution object
      const execution = {
        id: executionId,
        opportunity,
        status: 'pending',
        startTime: Date.now(),
        currentStep: 0,
        steps: [
          { type: 'buy', status: 'pending', exchange: opportunity.sourceExchange },
          { type: 'sell', status: 'pending', exchange: opportunity.destExchange }
        ],
        prices: {
          buy: opportunity.buyRate,
          sell: opportunity.sellRate
        },
        amounts: {
          buy: opportunity.investmentAmount / opportunity.buyRate,
          sell: opportunity.investmentAmount / opportunity.buyRate
        }
      };

      // Add to active executions
      this.activeExecutions.set(executionId, execution);
      
      // Notify listeners
      this.notifyListeners('onExecutionStart', execution);

      // Execute buy order
      await this.executeBuyOrder(execution);

      // Execute sell order
      await this.executeSellOrder(execution);

      // Complete execution
      execution.status = 'completed';
      execution.endTime = Date.now();
      
      // Calculate actual profit
      execution.actualProfit = await this.calculateActualProfit(execution);
      
      // Add to history
      this.executionHistory.push(execution);
      
      // Remove from active executions
      this.activeExecutions.delete(executionId);
      
      // Notify listeners
      this.notifyListeners('onExecutionComplete', execution);

    } catch (error) {
      console.error(`Error executing opportunity ${executionId}:`, error);
      
      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error.message;
        execution.endTime = Date.now();
        
        // Notify listeners
        this.notifyListeners('onExecutionError', execution);
        
        // Remove from active executions
        this.activeExecutions.delete(executionId);
      }
    }
  }

  /**
   * Execute buy order
   */
  async executeBuyOrder(execution) {
    const step = execution.steps[0];
    step.status = 'in_progress';
    
    try {
      // Simulate order placement
      await this.simulateOrderPlacement(execution.opportunity.sourceExchange, 'buy');
      
      // Wait for confirmation
      await this.waitForConfirmation(execution.opportunity.sourceExchange);
      
      step.status = 'completed';
      execution.currentStep++;
      
      // Notify listeners
      this.notifyListeners('onExecutionUpdate', execution);
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      throw error;
    }
  }

  /**
   * Execute sell order
   */
  async executeSellOrder(execution) {
    const step = execution.steps[1];
    step.status = 'in_progress';
    
    try {
      // Simulate order placement
      await this.simulateOrderPlacement(execution.opportunity.destExchange, 'sell');
      
      // Wait for confirmation
      await this.waitForConfirmation(execution.opportunity.destExchange);
      
      step.status = 'completed';
      execution.currentStep++;
      
      // Notify listeners
      this.notifyListeners('onExecutionUpdate', execution);
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      throw error;
    }
  }

  /**
   * Simulate order placement
   */
  async simulateOrderPlacement(exchange, type) {
    // In a real implementation, this would place actual orders on the exchange
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Wait for order confirmation
   */
  async waitForConfirmation(exchange) {
    // In a real implementation, this would wait for blockchain confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Update execution prices
   */
  updateExecutionPrices(executionId, execution, prices) {
    const opportunity = execution.opportunity;
    const currentPrices = this.getCurrentPrices(opportunity, prices);
    
    // Update execution prices
    execution.prices = currentPrices;
    
    // Recalculate amounts
    execution.amounts = {
      buy: opportunity.investmentAmount / currentPrices.buy,
      sell: opportunity.investmentAmount / currentPrices.buy
    };
    
    // Notify listeners
    this.notifyListeners('onExecutionUpdate', execution);
  }

  /**
   * Get current prices for an opportunity
   */
  getCurrentPrices(opportunity, prices = null) {
    if (!prices) {
      prices = this.priceService.getAllPrices();
    }
    
    return {
      buy: prices[opportunity.pair]?.[opportunity.sourceExchange] || opportunity.buyRate,
      sell: prices[opportunity.pair]?.[opportunity.destExchange] || opportunity.sellRate
    };
  }

  /**
   * Check if an opportunity is still valid
   */
  isOpportunityValid(opportunity, currentPrices) {
    const originalProfitPercent = opportunity.profitPercent;
    const currentProfitPercent = ((currentPrices.sell - currentPrices.buy) / currentPrices.buy) * 100;
    
    // Check if profit is still above threshold
    if (currentProfitPercent < this.settings.minProfitThreshold) {
      return false;
    }
    
    // Check if profit has dropped too much
    if (currentProfitPercent < originalProfitPercent * 0.5) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if we have enough balance
   */
  async hasEnoughBalance(opportunity) {
    // In a real implementation, this would check actual balances
    return true;
  }

  /**
   * Calculate actual profit from execution
   */
  async calculateActualProfit(execution) {
    // In a real implementation, this would calculate actual profit including fees
    return execution.opportunity.profit;
  }

  /**
   * Get active executions
   */
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return [...this.executionHistory];
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
}

export default ExecutionService; 