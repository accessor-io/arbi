#!/usr/bin/env node

/**
 * Start script for the Crypto Arbitrage application
 */
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Stopping application...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Stopping application...');
  await app.stop();
  process.exit(0);
});

// Set unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Application continues running
});

/**
 * Start the application
 */
async function start() {
  try {
    logger.info('Starting crypto arbitrage application...');
    
    // Initialize the application
    await app.initialize();
    
    // Start the application
    await app.start();
    
    // Start the API server
    const useApi = process.env.ENABLE_API !== 'false';
    if (useApi) {
      await startServer();
    }
    
    // Log initial status
    const status = app.getStatus();
    logger.info('Application started successfully', {
      isRunning: status.isRunning,
      initialized: status.initialized,
      tokenCount: status.tokens?.length || 0
    });
    
    // Set up periodic status updates
    setInterval(() => {
      const currentStatus = app.getStatus();
      logger.info('Application status update', {
        tokenCount: currentStatus.tokens?.length || 0,
        opportunities: app.services.arbitrage.getOpportunities().length,
        executions: app.services.execution.getActiveExecutions().length
      });
    }, 60000); // Update every minute
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
start().catch(error => {
  logger.error('Fatal error starting application:', error);
  process.exit(1);
}); 