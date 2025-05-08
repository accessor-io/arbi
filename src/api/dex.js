import express from 'express';
import DexAggregator from '../services/DexAggregator.js';
import RouteAggregator from '../services/RouteAggregator.js';
import { providers } from '../config/network.js';
import TokenManager from '../services/utils/TokenManager.js';

const router = express.Router();

// Initialize services
const dexAggregators = new Map();
const routeAggregators = new Map();
const tokenManagers = new Map();

// Initialize for each supported chain
const supportedChains = {
  '1': { 
    name: 'Ethereum Mainnet', 
    rpcUrl: process.env.ETH_RPC_URL,
    dexes: {
      uniswap: {
        routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
      },
      sushiswap: {
        routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
      }
    }
  },
  '56': { 
    name: 'BSC', 
    rpcUrl: process.env.BSC_RPC_URL,
    dexes: {
      pancakeswap: {
        routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
      }
    }
  },
  '137': { 
    name: 'Polygon', 
    rpcUrl: process.env.POLYGON_RPC_URL,
    dexes: {
      quickswap: {
        routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7d7FC6788',
        factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32'
      },
      sushiswap: {
        routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
      }
    }
  },
  '42161': { 
    name: 'Arbitrum', 
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    dexes: {
      uniswap: {
        routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
      },
      sushiswap: {
        routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
      }
    }
  },
  '10': { 
    name: 'Optimism', 
    rpcUrl: process.env.OPTIMISM_RPC_URL,
    dexes: {
      uniswap: {
        routerAddress: '0xE592427A0AEce92De1E4dE1CbDc5A5F960B63e9c',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
      }
    }
  }
};

// Initialize services for each chain
Object.entries(supportedChains).forEach(([chainId, config]) => {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  dexAggregators.set(chainId, new DexAggregator(provider, {
    cacheTimeout: 30 * 1000,
    ...config.dexes
  }));
  routeAggregators.set(chainId, new RouteAggregator(provider));
  tokenManagers.set(chainId, new TokenManager(provider));
});

// Get supported DEXes
router.get('/exchanges', async (req, res) => {
  try {
    const chainId = req.query.chain || '1';
    const aggregator = dexAggregators.get(chainId);
    
    if (!aggregator) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    const dexes = aggregator.getSupportedDexes().map(name => ({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      version: name.includes('V2') ? 'v2' : name.includes('V3') ? 'v3' : 'v2'
    }));
    
    res.json({ success: true, exchanges: dexes });
  } catch (error) {
    console.error('Error getting DEXes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get top tokens for a DEX
router.get('/dex/top-tokens', async (req, res) => {
  try {
    const { dex, chain, limit = 50 } = req.query;
    const chainId = chain || '1';
    const aggregator = dexAggregators.get(chainId);
    const tokenManager = tokenManagers.get(chainId);
    
    if (!aggregator || !tokenManager) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    // Get top tokens by liquidity
    const tokens = await tokenManager.getTopTokens(parseInt(limit));
    
    // Get prices for each token
    const results = {};
    const dexName = dex.replace(/_/g, ' ');
    
    results[dexName] = await Promise.all(
      tokens.map(async token => {
        try {
          const priceData = await aggregator.getBestPrice(
            token.address,
            tokenManager.getBaseTokenAddress(),
            ethers.utils.parseUnits('1', token.decimals)
          );
          
          return {
            ...token,
            priceUsd: priceData ? priceData.bestBuy.price.toString() : '0',
            volume24h: '0', // TODO: Implement 24h volume
            liquidity: '0' // TODO: Implement liquidity
          };
        } catch (error) {
          console.error(`Error getting price for ${token.symbol}:`, error);
          return {
            ...token,
            priceUsd: '0',
            volume24h: '0',
            liquidity: '0'
          };
        }
      })
    );
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error getting top tokens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get token prices across all DEXes
router.get('/tokens/:address/prices', async (req, res) => {
  try {
    const { address } = req.params;
    const chainId = req.query.chain || '1';
    const aggregator = dexAggregators.get(chainId);
    const tokenManager = tokenManagers.get(chainId);
    
    if (!aggregator || !tokenManager) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    // Get token info
    const token = await tokenManager.loadToken(address);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    
    // Get prices across all DEXes
    const priceData = await aggregator.getBestPrice(
      address,
      tokenManager.getBaseTokenAddress(),
      ethers.utils.parseUnits('1', token.decimals)
    );
    
    if (!priceData) {
      return res.status(404).json({ success: false, error: 'No price data available' });
    }
    
    // Format response
    const prices = {};
    priceData.allPrices.forEach(price => {
      prices[price.dex] = {
        price: price.price.toString(),
        buyPrice: price.buyPrice.toString(),
        sellPrice: price.sellPrice.toString()
      };
    });
    
    res.json({
      success: true,
      symbol: token.symbol,
      name: token.name,
      prices
    });
  } catch (error) {
    console.error('Error getting token prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get swap quote
router.get('/swap/quote', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, dex, chain } = req.query;
    const chainId = chain || '1';
    const aggregator = dexAggregators.get(chainId);
    
    if (!aggregator) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    
    const quote = await aggregator.getSwapQuote(tokenIn, tokenOut, amount, dex);
    
    if (!quote) {
      return res.status(404).json({ success: false, error: 'No quote available' });
    }
    
    res.json({ success: true, quote });
  } catch (error) {
    console.error('Error getting swap quote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get token icon
router.get('/tokens/:address/icon', async (req, res) => {
  try {
    const { address } = req.params;
    const chainId = req.query.chain || '1';
    const tokenManager = tokenManagers.get(chainId);
    
    if (!tokenManager) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    // Get token icon URL
    const iconUrl = await tokenManager.getTokenIcon(address);
    
    if (!iconUrl) {
      return res.redirect('/img/default-token.png');
    }
    
    res.redirect(iconUrl);
  } catch (error) {
    console.error('Error getting token icon:', error);
    res.redirect('/img/default-token.png');
  }
});

// Get best route between two tokens
router.get('/route', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, chain } = req.query;
    const chainId = chain || '1';
    const aggregator = routeAggregators.get(chainId);
    
    if (!aggregator) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    
    const route = await aggregator.findBestRoute(tokenIn, tokenOut, amount);
    
    if (!route) {
      return res.status(404).json({ success: false, error: 'No route found' });
    }
    
    res.json({ success: true, route });
  } catch (error) {
    console.error('Error getting best route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get arbitrage opportunities
router.get('/arbitrage', async (req, res) => {
  try {
    const { amount, chain } = req.query;
    const chainId = chain || '1';
    const aggregator = routeAggregators.get(chainId);
    
    if (!aggregator) {
      return res.status(400).json({ success: false, error: 'Unsupported chain' });
    }
    
    const opportunities = await aggregator.findArbitrageOpportunities(amount || ethers.utils.parseUnits('1', 18));
    
    res.json({ success: true, opportunities });
  } catch (error) {
    console.error('Error getting arbitrage opportunities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 