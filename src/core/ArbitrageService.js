import { providers } from '../config/network.js';
import Uniswap from '../exchanges/Uniswap.js';
import Sushiswap from '../exchanges/SushiSwap.js';
import TokenManager from '../services/utils/TokenManager.js';
import ArbitrageDetector from './ArbitrageDetector.js';
import ArbitrageExecutor from './ArbitrageExecutor.js';
import RouteAggregator from '../services/RouteAggregator.js';

class ArbitrageService {
  constructor() {
    this.provider = providers.mainnet;
    this.exchanges = [
      new Uniswap(this.provider),
      new Sushiswap(this.provider)
      // Add more exchanges as needed
    ];
    this.tokenManager = new TokenManager(this.provider);
    this.routeAggregator = new RouteAggregator(this.provider);
    this.detector = new ArbitrageDetector(this.routeAggregator, this.tokenManager);
    this.executor = new ArbitrageExecutor(this.exchanges, this.tokenManager);
    this.isScanning = false;
    this.scanInterval = null;
    this.opportunities = [];
  }

  async startScanning(intervalSeconds = 60) {
    if (this.isScanning) {
      console.log('Already scanning for opportunities');
      return;
    }
    
    this.isScanning = true;
    console.log('Starting arbitrage opportunity scanning...');
    
    // Run immediately once
    await this.scanForOpportunities();
    
    // Then set interval
    this.scanInterval = setInterval(async () => {
      await this.scanForOpportunities();
    }, intervalSeconds * 1000);
  }

  stopScanning() {
    if (!this.isScanning) {
      console.log('Not currently scanning');
      return;
    }
    
    clearInterval(this.scanInterval);
    this.isScanning = false;
    console.log('Stopped arbitrage opportunity scanning');
  }

  async scanForOpportunities() {
    try {
      console.log('Scanning for arbitrage opportunities...');
      await this.detector.findArbitrageOpportunities();
      this.opportunities = this.detector.getOpportunities();
      console.log(`Found ${this.opportunities.length} potential opportunities`);
      return this.opportunities;
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      return [];
    }
  }

  getOpportunities() {
    return this.opportunities;
  }

  async executeArbitrage(wallet, opportunityIndex, slippageTolerance) {
    if (opportunityIndex < 0 || opportunityIndex >= this.opportunities.length) {
      throw new Error('Invalid opportunity index');
    }
    
    const opportunity = this.opportunities[opportunityIndex];
    
    try {
      const result = await this.executor.executeArbitrage(
        wallet,
        opportunity,
        slippageTolerance
      );
      return {
        success: true,
        result,
        opportunity
      };
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      return {
        success: false,
        error: error.message,
        opportunity
      };
    }
  }
}

export default ArbitrageService;    