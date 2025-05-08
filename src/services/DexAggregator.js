import { ethers } from 'ethers';
import BaseDex from '../exchanges/BaseDex.js';
import UniswapV2 from '../exchanges/UniswapV2.js';
import SushiSwap from '../exchanges/Sushiswap.js';

class DexAggregator {
  constructor(provider, config = {}) {
    this.provider = provider;
    this.dexes = new Map();
    this.priceCache = new Map();
    this.cacheTimeout = config.cacheTimeout || 30 * 1000; // 30 seconds cache
    
    // Initialize supported DEXes
    this.initializeDexes(config);
  }
  
  initializeDexes(config) {
    // Add supported DEXes
    this.addDex(new UniswapV2(this.provider, config.uniswap));
    this.addDex(new SushiSwap(this.provider, config.sushiswap));
    // Add more DEXes as needed
  }
  
  addDex(dex) {
    if (!(dex instanceof BaseDex)) {
      throw new Error('DEX must extend BaseDex class');
    }
    this.dexes.set(dex.name, dex);
  }
  
  async getBestPrice(tokenAddress, baseTokenAddress, amount) {
    const cacheKey = `${tokenAddress}-${baseTokenAddress}-${amount}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const prices = await Promise.all(
      Array.from(this.dexes.values()).map(async (dex) => {
        try {
          const priceData = await dex.getTokenPrice(tokenAddress, baseTokenAddress, amount);
          if (priceData) {
            return {
              dex: dex.name,
              ...priceData
            };
          }
          return null;
        } catch (error) {
          console.error(`Error getting price from ${dex.name}:`, error);
          return null;
        }
      })
    );
    
    const validPrices = prices.filter(p => p !== null);
    
    if (validPrices.length === 0) {
      return null;
    }
    
    // Find best buy and sell prices
    const bestBuy = validPrices.reduce((best, current) => 
      current.price < best.price ? current : best
    );
    
    const bestSell = validPrices.reduce((best, current) => 
      current.price > best.price ? current : best
    );
    
    const result = {
      bestBuy,
      bestSell,
      arbitrage: {
        profit: bestSell.price / bestBuy.price - 1,
        buyDex: bestBuy.dex,
        sellDex: bestSell.dex
      },
      allPrices: validPrices
    };
    
    // Cache the result
    this.priceCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });
    
    return result;
  }
  
  async getTokenPrices(tokenAddress, baseTokenAddress, amounts = []) {
    const results = {};
    
    for (const amount of amounts) {
      const priceData = await this.getBestPrice(tokenAddress, baseTokenAddress, amount);
      if (priceData) {
        results[amount.toString()] = priceData;
      }
    }
    
    return results;
  }
  
  async getDexLiquidity(tokenAddress, baseTokenAddress) {
    const liquidity = {};
    
    for (const [name, dex] of this.dexes) {
      try {
        const priceData = await dex.getTokenPrice(tokenAddress, baseTokenAddress, ethers.utils.parseUnits('1', 18));
        if (priceData) {
          liquidity[name] = {
            price: priceData.price,
            buyPrice: priceData.buyPrice,
            sellPrice: priceData.sellPrice
          };
        }
      } catch (error) {
        console.error(`Error getting liquidity from ${name}:`, error);
      }
    }
    
    return liquidity;
  }
  
  getSupportedDexes() {
    return Array.from(this.dexes.keys());
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn, dexName = null) {
    if (dexName) {
      const dex = this.dexes.get(dexName);
      if (!dex) {
        throw new Error(`DEX ${dexName} not found`);
      }
      return dex.getSwapQuote(tokenIn, tokenOut, amountIn);
    }

    // Get quotes from all DEXes and find the best one
    const quotes = await Promise.all(
      Array.from(this.dexes.values()).map(async (dex) => {
        try {
          const quote = await dex.getSwapQuote(tokenIn, tokenOut, amountIn);
          if (quote) {
            return {
              dex: dex.name,
              ...quote
            };
          }
          return null;
        } catch (error) {
          console.error(`Error getting quote from ${dex.name}:`, error);
          return null;
        }
      })
    );

    const validQuotes = quotes.filter(q => q !== null);
    if (validQuotes.length === 0) {
      return null;
    }

    // Find the quote with the highest output amount
    return validQuotes.reduce((best, current) => 
      current.amountOut > best.amountOut ? current : best
    );
  }
}

export default DexAggregator; 