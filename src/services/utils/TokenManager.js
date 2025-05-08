import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard ERC20 ABI (minimal)
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)"
];

class TokenManager {
  constructor(provider) {
    this.provider = provider;
    this.tokenCache = new Map();
    this.iconCache = new Map();
    this.baseTokens = {
      '1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '56': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      '137': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
      '42161': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
      '10': '0x4200000000000000000000000000000000000006' // WETH
    };
    this.tokens = new Map();
    this.tokenPairs = {};
    this.popularTokens = [
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC' },
      // Add more popular tokens as needed
    ];
  }

  async initialize() {
    try {
      logger.info('Initializing TokenManager...');
      
      // Preload base tokens
      const chainId = (await this.provider.getNetwork()).chainId.toString();
      const baseTokenAddress = this.getBaseTokenAddress(chainId);
      if (baseTokenAddress) {
        await this.loadToken(baseTokenAddress);
      }

      // Preload popular tokens
      for (const token of this.popularTokens) {
        await this.loadToken(token.address);
      }

      // Preload common pairs
      const commonPairs = this.getCommonPairs();
      for (const pair of commonPairs) {
        await Promise.all([
          this.loadToken(pair.base),
          this.loadToken(pair.quote)
        ]);
      }

      logger.info('TokenManager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize TokenManager:', error);
      throw error;
    }
  }

  getBaseTokenAddress(chainId = '1') {
    return this.baseTokens[chainId];
  }

  async loadToken(address) {
    if (this.tokenCache.has(address)) {
      return this.tokenCache.get(address);
    }

    try {
      const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);

      const token = {
        address,
        name,
        symbol,
        decimals,
        contract
      };

      this.tokenCache.set(address, token);
      return token;
    } catch (error) {
      console.error(`Error loading token ${address}:`, error);
      return null;
    }
  }

  async getTokenIcon(address) {
    if (this.iconCache.has(address)) {
      return this.iconCache.get(address);
    }

    try {
      // Try to fetch from popular token list APIs
      const response = await axios.get(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`);
      if (response.status === 200) {
        this.iconCache.set(address, response.config.url);
        return response.config.url;
      }
    } catch (error) {
      console.debug(`No icon found for token ${address}`);
      return null;
    }
  }

  async getTopTokens(limit = 100) {
    // For now, return popular tokens. In production, this would fetch from an API
    return this.popularTokens.slice(0, limit);
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      return balance;
    } catch (error) {
      console.error(`Error getting balance for token ${tokenAddress}:`, error);
      return ethers.BigNumber.from(0);
    }
  }

  async checkAllowance(tokenAddress, walletAddress, spenderAddress) {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const allowance = await contract.allowance(walletAddress, spenderAddress);
      return allowance;
    } catch (error) {
      console.error(`Error checking allowance for token ${tokenAddress}:`, error);
      return ethers.BigNumber.from(0);
    }
  }

  async approveToken(wallet, tokenAddress, spenderAddress, amount) {
    const token = await this.loadToken(tokenAddress);
    if (!token) throw new Error('Token not found');
    
    const tokenWithSigner = token.contract.connect(wallet);
    const tx = await tokenWithSigner.approve(
      spenderAddress,
      ethers.utils.parseUnits(amount.toString(), token.decimals)
    );
    
    return tx;
  }

  // Get commonly traded pairs across exchanges
  getCommonPairs() {
    // For simplicity, return predefined pairs
    // In production, this could be determined dynamically based on liquidity
    return [
      { base: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', quote: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }, // WETH/USDC
      { base: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', quote: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }, // WETH/USDT
      { base: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', quote: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }, // WETH/WBTC
      // Add more common pairs as needed
    ];
  }
}

export default TokenManager; 