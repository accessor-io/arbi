require('dotenv').config();
const { providers, setupWallet } = require('./config/network');
const ArbitrageService = require('./core/ArbitrageService');
const LoggingService = require('./services/LoggingService');
const TaskScheduler = require('./services/TaskScheduler');
const AppOrchestrator = require('./core/AppOrchestrator');
const AnalyticsService = require('./services/AnalyticsService');
const MonitoringService = require('./services/MonitoringService');

async function runTest() {
  console.log('Starting Ethereum Arbitrage Bot Test');
  
  // Initialize services
  const logger = new LoggingService({ logLevel: 'debug' });
  const taskScheduler = new TaskScheduler();
  const arbitrageService = new ArbitrageService();
  const analyticsService = new AnalyticsService();
  
  let wallet = null;
  let monitoringService = null;
  
  try {
    wallet = setupWallet();
    logger.info(`Wallet loaded for address: ${wallet.address}`);
    
    monitoringService = new MonitoringService(
      providers.mainnet,
      wallet,
      {
        checkInterval: 60000, // Check every minute for test
        alertCallbacks: [
          (alert) => { logger.warn(`ALERT: ${alert.type} - ${alert.message}`); }
        ]
      }
    );
  } catch (error) {
    logger.warn('No wallet configured. Trading functionality will be disabled.', error);
  }
  
  // Create app orchestrator
  const orchestrator = new AppOrchestrator({
    arbitrageService,
    monitoringService,
    analyticsService,
    logger,
    scanInterval: 10000, // Scan every 10 seconds for testing
  });
  
  // Start the orchestrator
  orchestrator.start();
  
  // Run a single scan and get results
  logger.info('Running initial arbitrage scan...');
  const opportunities = await orchestrator.runArbitrageScan();
  
  if (opportunities.length > 0) {
    // Display the top 3 opportunities (or fewer if less are found)
    const topOpportunities = opportunities.slice(0, Math.min(3, opportunities.length));
    
    topOpportunities.forEach((opp, index) => {
      logger.info(`Opportunity ${index + 1}:`);
      logger.info(`  Pair: ${opp.tokenA.symbol}/${opp.tokenB.symbol}`);
      logger.info(`  Buy: ${opp.buy.exchange} @ ${Number(opp.buy.price).toFixed(8)}`);
      logger.info(`  Sell: ${opp.sell.exchange} @ ${Number(opp.sell.price).toFixed(8)}`);
      logger.info(`  Amount: ${Number(opp.tokenA.amount).toFixed(4)} ${opp.tokenA.symbol}`);
      logger.info(`  Profit: ${opp.profitPercent.toFixed(2)}%`);
      logger.info(`  Est. Profit: ${Number(opp.estimatedProfitInTokenB).toFixed(6)} ${opp.tokenB.symbol}`);
    });
    
    // Execute test trade if configured
    if (wallet && process.env.EXECUTE_TEST_TRADE === 'true') {
      logger.info('Executing test trade for the top opportunity...');
      try {
        const result = await orchestrator.executeTestTrade(
          0, // First opportunity
          wallet,
          parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5')
        );
        
        if (result.success) {
          logger.info('Trade executed successfully!');
          logger.info(`Buy transaction: ${result.result.buyTx}`);
          logger.info(`Sell transaction: ${result.result.sellTx}`);
        } else {
          logger.error(`Trade failed: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Error executing trade: ${error.message}`);
      }
    }
  }
  
  // Keep the process running for tests
  logger.info('Test initiated. Bot will continue running until manually stopped (Ctrl+C).');
  logger.info('Scanning for arbitrage opportunities every 10 seconds...');
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error in test:', error);
}); 