import ConfigService from '../ConfigService.js';

describe('ConfigService', () => {
  let configService;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      NODE_ENV: 'test'
    };
    configService = new ConfigService();
  });

  afterEach(() => {
    // Clean up
    configService.cleanup();
  });

  describe('initialization', () => {
    it('should load default configuration', async () => {
      await configService.initialize();
      expect(configService.get('server.port')).toBe(3000);
      expect(configService.get('server.host')).toBe('localhost');
      expect(configService.get('server.ssl')).toBe(false);
    });

    it('should override defaults with environment variables', async () => {
      process.env.ARBI_SERVER_PORT = '4000';
      process.env.ARBI_SERVER_HOST = 'example.com';
      process.env.ARBI_SERVER_SSL = 'true';

      await configService.initialize();
      expect(configService.get('server.port')).toBe(4000);
      expect(configService.get('server.host')).toBe('example.com');
      expect(configService.get('server.ssl')).toBe(true);
    });

    it('should handle missing required configuration', async () => {
      // Mock default config to remove required fields
      jest.mock('../../../config.example.js', () => ({}));

      await expect(configService.initialize()).rejects.toThrow('Missing required configuration');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await configService.initialize();
    });

    it('should return configuration value', () => {
      expect(configService.get('arbitrage.scanInterval')).toBe(60);
    });

    it('should return default value for missing configuration', () => {
      expect(configService.get('nonexistent.key', 'default')).toBe('default');
    });

    it('should return null for missing configuration without default', () => {
      expect(configService.get('nonexistent.key')).toBeNull();
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await configService.initialize();
    });

    it('should set configuration value', () => {
      configService.set('test.key', 'value');
      expect(configService.get('test.key')).toBe('value');
    });

    it('should override existing configuration value', () => {
      configService.set('server.port', 5000);
      expect(configService.get('server.port')).toBe(5000);
    });
  });

  describe('getAll', () => {
    beforeEach(async () => {
      await configService.initialize();
    });

    it('should return all configuration values', () => {
      const config = configService.getAll();
      expect(config).toHaveProperty('server.port');
      expect(config).toHaveProperty('arbitrage.scanInterval');
      expect(config).toHaveProperty('monitoring.enabled');
    });
  });

  describe('environment-specific configuration', () => {
    it('should load development configuration', async () => {
      process.env.NODE_ENV = 'development';
      await configService.initialize();
      expect(configService.get('arbitrage.minProfit')).toBe(0.05);
    });

    it('should load production configuration', async () => {
      process.env.NODE_ENV = 'production';
      await configService.initialize();
      expect(configService.get('arbitrage.minProfit')).toBe(0.2);
      expect(configService.get('security.whitelistEnabled')).toBe(true);
    });

    it('should load staging configuration', async () => {
      process.env.NODE_ENV = 'staging';
      await configService.initialize();
      expect(configService.get('arbitrage.minProfit')).toBe(0.1);
    });
  });

  describe('cleanup', () => {
    it('should clear configuration', async () => {
      await configService.initialize();
      expect(configService.get('server.port')).toBe(3000);

      await configService.cleanup();
      expect(configService.get('server.port')).toBeNull();
    });
  });
}); 