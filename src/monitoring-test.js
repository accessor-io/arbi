require('dotenv').config();
const { providers, setupWallet } = require('./config/network');
const MonitoringService = require('./services/MonitoringService');
const LoggingService = require('./services/LoggingService');

async function runMonitoringTest() {
  const logger = new LoggingService({ logLevel: 'debug' });
  logger.info('Starting monitoring test');
  
  let wallet = null;
  try {
    wallet = setupWallet();
    logger.info(`Wallet loaded: ${wallet.address}`);
  } catch (error) {
    logger.warn('No wallet configured', error);
  }
  
  const monitoringService = new MonitoringService(
    providers.mainnet,
    wallet,
    {
      checkInterval: 60000, // Check every minute
      alertCallbacks: [
        (alert) => {
          logger.warn(`ALERT: ${alert.type} - ${alert.message}`);
        }
      ]
    }
  );
  
  // Start monitoring
  logger.info('Starting monitoring service');
  await monitoringService.start();
  
  // Keep the process running for the test duration
  logger.info('Monitoring active. Press Ctrl+C to stop.');
}

runMonitoringTest().catch(error => {
  console.error('Error in monitoring test:', error);
}); 