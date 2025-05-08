import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

export const config = {
  // Network Configuration
  networks: {
    ethereum: {
      rpc: {
        primary: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        fallback: process.env.ETHEREUM_FALLBACK_RPC_URL || 'https://rpc.ankr.com/eth'
      },
      chainId: 1
    },
    arbitrum: {
      rpc: {
        primary: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        fallback: process.env.ARBITRUM_FALLBACK_RPC_URL || 'https://rpc.ankr.com/arbitrum'
      },
      chainId: 42161
    }
  },

  // Trading Configuration
  trading: {
    minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD || '1000000000000000', // 0.001 ETH
    maxGasPrice: process.env.MAX_GAS_PRICE || '50000000000', // 50 gwei
    maxSlippage: process.env.MAX_SLIPPAGE || 0.5, // 0.5%
    minLiquidity: process.env.MIN_LIQUIDITY || '1000000000000000000' // 1 ETH
  },

  // DEX Configuration
  dexes: {
    uniswap: {
      router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
    },
    sushiswap: {
      router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
    },
    pancakeswap: {
      router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: path.join(__dirname, '../../logs')
  },

  // API Configuration
  api: {
    port: process.env.API_PORT || 3000,
    cors: {
      origin: process.env.CORS_ORIGIN || '*'
    }
  }
};

export default config; 