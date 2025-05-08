# Arbitrage Trading System

A modular and configurable system for cryptocurrency arbitrage trading.

## Project Structure

```
src/
├── services/
│   ├── core/
│   │   ├── ConfigService.js      # Configuration management
│   │   └── ServiceContainer.js   # Dependency injection container
│   ├── arbitrage/
│   │   ├── ArbitrageService.js   # Arbitrage opportunity detection
│   │   └── ExecutionService.js   # Trade execution
│   ├── monitoring/
│   │   ├── MonitoringService.js  # System monitoring
│   │   └── NotificationService.js # Alerts and notifications
│   ├── analytics/
│   │   └── AnalyticsService.js   # Performance analytics
│   ├── security/
│   │   └── SecurityService.js    # Trade validation and security
│   └── utils/
│       ├── GasService.js         # Gas price management
│       └── TaskScheduler.js      # Task scheduling
├── utils/
│   └── logger.js                 # Logging utility
└── config.example.js             # Configuration template
```

## Services

### Core Services

- **ConfigService**: Manages application configuration from environment variables and config files
- **ServiceContainer**: Handles dependency injection and service lifecycle management

### Business Services

- **ArbitrageService**: Detects and processes arbitrage opportunities
- **ExecutionService**: Executes trades with retry logic and gas optimization
- **MonitoringService**: Monitors system health and performance
- **NotificationService**: Handles alerts and notifications through various channels
- **AnalyticsService**: Tracks and analyzes trading performance
- **SecurityService**: Validates trades and manages security rules
- **GasService**: Optimizes gas prices for transactions
- **TaskScheduler**: Manages scheduled tasks and background processes

## Configuration

The system uses a hierarchical configuration system with the following precedence:

1. Environment variables (highest priority)
2. Environment-specific configuration
3. Default configuration (lowest priority)

### Configuration File

Copy `config.example.js` to `config.js` and adjust the values:

```javascript
{
  server: {
    port: 3000,
    host: 'localhost',
    ssl: false
  },
  arbitrage: {
    scanInterval: 60,    // seconds
    maxSlippage: 0.5,    // percentage
    minProfit: 0.1      // percentage
  },
  execution: {
    maxConcurrent: 5,
    maxRetries: 3,
    retryDelay: 1000    // milliseconds
  },
  // ... see config.example.js for full configuration
}
```

### Environment Variables

Environment variables override configuration file values. Use the `ARBI_` prefix:

```bash
# Server Configuration
ARBI_SERVER_PORT=3000
ARBI_SERVER_HOST=localhost
ARBI_SERVER_SSL=false

# Arbitrage Configuration
ARBI_ARBITRAGE_SCAN_INTERVAL=60
ARBI_ARBITRAGE_MAX_SLIPPAGE=0.5
ARBI_ARBITRAGE_MIN_PROFIT=0.1

# See config.example.js for all available options
```

## Getting Started

1. Clone the repository
2. Copy `config.example.js` to `config.js`
3. Adjust configuration values
4. Install dependencies: `npm install`
5. Start the system: `npm start`

## Development

### Adding a New Service

1. Create a new service file in the appropriate directory
2. Implement the service with standard lifecycle methods:
   - `constructor(configService, ...dependencies)`
   - `async initialize()`
   - `async cleanup()`
3. Add the service to `ServiceContainer.js`
4. Update configuration in `config.example.js`

### Best Practices

- Use dependency injection via the `ServiceContainer`
- Implement proper error handling and logging
- Follow the service lifecycle pattern
- Add configuration values to `config.example.js`
- Document new features and configuration options

## License

MIT
