/**
 * Application startup script
 */
import app from './index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function start() {
  try {
    // Initialize the application
    await app.initialize();
    
    // Start the application
    await app.start();
    
    // Log initial status
    const status = app.getStatus();
    console.log('Application Status:', {
      isRunning: status.isRunning,
      initialized: status.initialized,
      tokens: status.tokens.length,
      metrics: status.metrics
    });
    
    // Set up periodic status updates
    setInterval(() => {
      const currentStatus = app.getStatus();
      console.log('Current Status:', {
        tokens: currentStatus.tokens.length,
        metrics: currentStatus.metrics
      });
    }, 60000); // Update every minute
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
start(); 