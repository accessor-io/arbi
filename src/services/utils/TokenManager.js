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
    this.dexes = [];
    this.pairs = [];
    this.popularTokens = [
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC' },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI' },
      { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI' },
      { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE' },
      { address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', symbol: 'MKR' },
      { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK' },
      { address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', symbol: 'MANA' },
      { address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF', symbol: 'BAT' },
      { address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498', symbol: 'ZRX' },
      { address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53', symbol: 'BUSD' },
      { address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', symbol: 'SHIB' },
      { address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', symbol: 'HEX' },
      { address: '0x1f98431c8aD98523631AE4a59f267346ea31F984', symbol: 'UNIV3' },
      { address: '0x111111111117dC0aa78b770fA6A738034120C302', symbol: '1INCH' },
      { address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC' },
      { address: '0x6c6EE5e31d828De241282B9606C8e98Ea48526E2', symbol: 'HOT' },
      { address: '0x4a220E6096B25EADb88358cb44068A3248254675', symbol: 'QNT' },
      { address: '0x8f8221aFbB33998d8584A2B05749bA73c37a938a', symbol: 'REQ' },
      { address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', symbol: 'YFI' },
      { address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', symbol: 'SUSHI' },
      { address: '0x9BE89D2a4cd102D8Fecc6BF9dA793be995C22541', symbol: 'BBTC' },
      { address: '0x1fE24F25b1Cf609B9c4e7E12D802e3640dFA5e43', symbol: 'CGG' },
      { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', symbol: 'UNISWAP_ROUTER' },
      { address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', symbol: 'UNISWAP_FACTORY' },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI' },
      { address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', symbol: 'MKR' },
      { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI' },
      { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE' },
      { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK' },
      { address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', symbol: 'MANA' },
      { address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF', symbol: 'BAT' },
      { address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498', symbol: 'ZRX' },
      { address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53', symbol: 'BUSD' },
      { address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', symbol: 'SHIB' },
      { address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', symbol: 'HEX' },
      { address: '0x1f98431c8aD98523631AE4a59f267346ea31F984', symbol: 'UNIV3' },
      { address: '0x111111111117dC0aa78b770fA6A738034120C302', symbol: '1INCH' },
      { address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC' },
      { address: '0x6c6EE5e31d828De241282B9606C8e98Ea48526E2', symbol: 'HOT' },
      { address: '0x4a220E6096B25EADb88358cb44068A3248254675', symbol: 'QNT' },
      { address: '0x8f8221aFbB33998d8584A2B05749bA73c37a938a', symbol: 'REQ' },
      { address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', symbol: 'YFI' },
      { address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', symbol: 'SUSHI' },
      { address: '0x9BE89D2a4cd102D8Fecc6BF9dA793be995C22541', symbol: 'BBTC' },
      { address: '0x1fE24F25b1Cf609B9c4e7E12D802e3640dFA5e43', symbol: 'CGG' },
      { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', symbol: 'UNISWAP_ROUTER' },
      { address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', symbol: 'UNISWAP_FACTORY' },
      { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', symbol: 'UNISWAP_V3_ROUTER' },
      { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', symbol: 'UNISWAP_V3_ROUTER_02' },
      { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', symbol: 'UNISWAP_V3_FACTORY' },
      { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', symbol: 'UNISWAP_V2_ROUTER' }
    ];
    // Configure provider with longer timeout and retry logic
    if (this.provider) {
      // Set a longer timeout for all provider requests
      this.provider.timeout = 30000; // 30 seconds
      
      // Add retry logic to the provider
      const originalSend = this.provider.send;
      this.provider.send = async (method, params) => {
        const maxRetries = 3;
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await originalSend.call(this.provider, method, params);
          } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
              logger.warn(`Provider request retry ${i + 1}/${maxRetries} for ${method}: ${error.message}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
          }
        }
        throw lastError;
      };
    }
  }

  async initialize() {
    try {
      logger.info('Initializing TokenManager...');
      
      // Preload base tokens
      const chainId = (await this.provider.getNetwork()).chainId.toString();
      const baseTokenAddress = this.getBaseTokenAddress(chainId);
      if (baseTokenAddress) {
        await this.loadTokenWithRetry(baseTokenAddress);
      }

      // Preload popular tokens
      for (const token of this.popularTokens) {
        await this.loadTokenWithRetry(token.address);
      }

      // Preload common pairs
      const commonPairs = this.getCommonPairs();
      for (const pair of commonPairs) {
        await Promise.all([
          this.loadTokenWithRetry(pair.base),
          this.loadTokenWithRetry(pair.quote)
        ]);
      }

      logger.info('TokenManager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize TokenManager:', error);
      throw error;
    }
  }

  async loadTokenWithRetry(address, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const token = await this.loadToken(address);
        if (token) return token;
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          logger.warn(`Retry ${i + 1}/${maxRetries} loading token ${address}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
        }
      }
    }
    logger.error(`Failed to load token ${address} after ${maxRetries} retries:`, lastError);
    return null;
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
      
      // Use a longer timeout for token loading
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token load timeout')), 30000) // Increased to 30 seconds
      );

      // Try to load token data with timeout
      let name, symbol, decimals;
      try {
        [name, symbol, decimals] = await Promise.race([
          Promise.all([
            contract.name().catch(() => 'Unknown'),
            contract.symbol().catch(() => '???'),
            contract.decimals().catch(() => 18)
          ]),
          timeout
        ]);
      } catch (error) {
        // If we get a timeout, try to load from cache or use defaults
        logger.warn(`Timeout loading token ${address}, using fallback data`);
        name = 'Unknown';
        symbol = '???';
        decimals = 18;
      }

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
      logger.error(`Error loading token ${address}:`, error);
      // Return a basic token object even on error to prevent cascading failures
      const fallbackToken = {
        address,
        name: 'Unknown',
        symbol: '???',
        decimals: 18,
        contract: new ethers.Contract(address, ERC20_ABI, this.provider)
      };
      this.tokenCache.set(address, fallbackToken);
      return fallbackToken;
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
      logger.debug(`No icon found for token ${address}`);
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
      logger.error(`Error getting balance for token ${tokenAddress}:`, error);
      return ethers.BigNumber.from(0);
    }
  }

  async checkAllowance(tokenAddress, walletAddress, spenderAddress) {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const allowance = await contract.allowance(walletAddress, spenderAddress);
      return allowance;
    } catch (error) {
      logger.error(`Error checking allowance for token ${tokenAddress}:`, error);
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
    // Generate pairs from popular tokens
    const pairs = [];
    const stablecoins = [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      '0x4Fabb145d64652a948d72533023f6E7A623C7C53'  // BUSD
    ];

    // Create pairs between WETH and all other tokens
    const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    for (const token of this.popularTokens) {
      if (token.address !== weth) {
        pairs.push({ base: weth, quote: token.address });
      }
    }

    // Create pairs between stablecoins and major tokens
    const majorTokens = [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
      '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', // AAVE
      '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
      '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'  // SHIB
    ];

    for (const stablecoin of stablecoins) {
      for (const token of majorTokens) {
        pairs.push({ base: stablecoin, quote: token });
      }
    }

    // Load all tokens in pairs
    for (const pair of pairs) {
      this.loadTokenWithRetry(pair.base);
      this.loadTokenWithRetry(pair.quote);
    }

    logger.info(`[TokenManager] Generated ${pairs.length} token pairs for analysis`);
    return pairs;
  }

  addDex(dex) {
    this.dexes.push(dex);
  }

  async fetchPairs() {
    logger.info('[TokenManager] Starting to fetch pairs from DEXes...');
    for (const dex of this.dexes) {
      try {
        const pairs = await dex.getPairs();
        if (pairs && pairs.length > 0) {
          this.pairs.push(...pairs);
          logger.info(`[TokenManager] Fetched ${pairs.length} pairs from ${dex.name}`);
        }
      } catch (error) {
        logger.error(`[TokenManager] Error fetching pairs from ${dex.name}:`, error);
      }
    }
    logger.info(`[TokenManager] Total pairs fetched: ${this.pairs.length}`);
  }
}

export default TokenManager; 