import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import BaseDex from './BaseDex.js';

class GMXDex extends BaseDex {
  constructor(provider) {
    super(provider, 'GMX');
    this.routerAddress = '0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064'; // GMX Router
    this.vaultAddress = '0x489ee077994B6658eAfA855C308275EAd8097C4A'; // GMX Vault
  }

  async getPairs() {
    try {
      const vault = new ethers.Contract(
        this.vaultAddress,
        [
          'function allWhitelistedTokens() view returns (address[])',
          'function tokenDecimals(address) view returns (uint256)'
        ],
        this.provider
      );

      // Get all whitelisted tokens
      const tokens = await vault.allWhitelistedTokens();
      const pairs = new Set();

      // Create pairs with WETH
      const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'; // WETH on Arbitrum
      
      for (const token of tokens) {
        if (token !== WETH && token !== ethers.ZeroAddress) {
          pairs.add(JSON.stringify({
            token0: WETH,
            token1: token,
            market: token
          }));
        }
      }

      return Array.from(pairs).map(pair => JSON.parse(pair));
    } catch (error) {
      logger.error('Error fetching GMX pairs:', error);
      return [];
    }
  }

  async getQuote(params) {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      
      const vault = new ethers.Contract(
        this.vaultAddress,
        [
          'function getMaxPrice(address) view returns (uint256)',
          'function getMinPrice(address) view returns (uint256)',
          'function tokenDecimals(address) view returns (uint256)'
        ],
        this.provider
      );

      // Get token decimals
      const [tokenInDecimals, tokenOutDecimals] = await Promise.all([
        vault.tokenDecimals(tokenIn),
        vault.tokenDecimals(tokenOut)
      ]);

      // Get prices
      const [tokenInPrice, tokenOutPrice] = await Promise.all([
        vault.getMaxPrice(tokenIn),
        vault.getMinPrice(tokenOut)
      ]);

      // Calculate amount out
      const amountOut = (amountIn * tokenInPrice) / tokenOutPrice;
      const price = ethers.formatUnits(amountOut, tokenOutDecimals) / ethers.formatUnits(amountIn, tokenInDecimals);

      return {
        source: this.name,
        price: price.toString(),
        amountOut: amountOut.toString()
      };
    } catch (error) {
      logger.error(`Error getting GMX quote: ${error.message}`);
      return null;
    }
  }

  async findBestPath(tokenIn, tokenOut) {
    const pairs = await this.getPairs();
    const directPair = pairs.find(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    );

    if (directPair) {
      return [tokenIn, tokenOut];
    }

    // GMX uses WETH as the base token
    const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const hasWethPair = pairs.some(p => 
      (p.token0.toLowerCase() === tokenIn.toLowerCase() && p.token1.toLowerCase() === WETH.toLowerCase()) ||
      (p.token0.toLowerCase() === WETH.toLowerCase() && p.token1.toLowerCase() === tokenIn.toLowerCase())
    ) && pairs.some(p => 
      (p.token0.toLowerCase() === WETH.toLowerCase() && p.token1.toLowerCase() === tokenOut.toLowerCase()) ||
      (p.token0.toLowerCase() === tokenOut.toLowerCase() && p.token1.toLowerCase() === WETH.toLowerCase())
    );

    if (hasWethPair) {
      return [tokenIn, WETH, tokenOut];
    }

    return null;
  }
}

export default GMXDex; 