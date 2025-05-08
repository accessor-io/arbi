/**
 * API Server for Crypto Arbitrage
 */
import express from 'express';
import app from '../index.js';

// Create Express application
const server = express();
const port = process.env.PORT || 3000;

// Middleware
server.use(express.json());

// Basic security middleware
server.use((req, res, next) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Basic rate limiting
  // Note: In production, use a proper rate-limiting middleware
  next();
});

// Routes
server.get('/api/status', (req, res) => {
  const status = app.getStatus();
  res.json({
    success: true,
    status: {
      isRunning: status.isRunning,
      initialized: status.initialized,
      tokenCount: status.tokens?.length || 0
    }
  });
});

server.get('/api/tokens', (req, res) => {
  const status = app.getStatus();
  res.json({
    success: true,
    tokens: status.tokens || []
  });
});

server.get('/api/metrics', (req, res) => {
  const status = app.getStatus();
  res.json({
    success: true,
    metrics: status.metrics || {}
  });
});

server.get('/api/alerts', (req, res) => {
  const status = app.getStatus();
  res.json({
    success: true,
    alerts: status.alerts || []
  });
});

server.get('/api/opportunities', (req, res) => {
  const opportunities = app.services.arbitrage.getOpportunities();
  res.json({
    success: true,
    opportunities: opportunities || []
  });
});

server.post('/api/settings', (req, res) => {
  const { settings } = req.body;
  
  if (!settings) {
    return res.status(400).json({
      success: false,
      error: 'No settings provided'
    });
  }
  
  try {
    app.updateSettings(settings);
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
server.use((err, req, res, next) => {
  console.error('API Error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

/**
 * Start the API server
 */
export function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = server.listen(port, () => {
      console.log(`API server listening on port ${port}`);
      resolve(httpServer);
    });
    
    httpServer.on('error', (error) => {
      console.error('Failed to start API server:', error);
      reject(error);
    });
  });
}

export default server; 