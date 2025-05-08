import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BaseDex {
  constructor(provider, config = {}) {
    if (!provider) {
      throw new Error('Provider is required');
    }
    this.provider = provider;
    this.config = {
      routerAddress: config.routerAddress,
      factoryAddress: config.factoryAddress,
      name: config.name || 'BaseDex',
      version: config.version || 'v2',
      ...config
    };
    this.routerContract = null;
    this.abiLoaded = false;
    this.contracts = new Map();
  }

  get name() {
    return this.config.name;
  }

  get version() {
    return this.config.version;
  }

  // Lazy-load ABI only when needed
  async loadABI() {
    if (this.abiLoaded) return;
    
    const abiCachePath = path.join(__dirname, '../../cache', `${this.name.toLowerCase()}_router.json`);
    const cacheDir = path.dirname(abiCachePath);
    
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Try to load from cache first
      if (fs.existsSync(abiCachePath)) {
        const abiData = JSON.parse(fs.readFileSync(abiCachePath, 'utf8'));
        this.routerContract = new ethers.Contract(this.config.routerAddress, abiData, this.provider);
        this.abiLoaded = true;
        return;
      }
    } catch (error) {
      console.log(`Cache miss or error for ${this.name} ABI:`, error.message);
    }

    // Fetch from Etherscan if not in cache
    try {
      const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
      if (!etherscanApiKey) {
        throw new Error('ETHERSCAN_API_KEY environment variable is not set');
      }

      const response = await axios.get(
        `https://api.etherscan.io/api?module=contract&action=getabi&address=${this.config.routerAddress}&apikey=${etherscanApiKey}`
      );
      
      if (response.data.status === '1') {
        const abi = JSON.parse(response.data.result);
        
        // Save to cache
        try {
          fs.writeFileSync(abiCachePath, JSON.stringify(abi));
        } catch (error) {
          console.warn(`Failed to cache ABI for ${this.name}:`, error.message);
        }
        
        this.routerContract = new ethers.Contract(this.config.routerAddress, abi, this.provider);
        this.abiLoaded = true;
      } else {
        throw new Error(`Failed to fetch ABI: ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error loading ABI for ${this.name}:`, error.message);
      throw error;
    }
  }

  async getTokenPrice(tokenAddress, baseTokenAddress, amount) {
    throw new Error('getTokenPrice must be implemented by DEX class');
  }

  async getLiquidity(tokenAddress, baseTokenAddress) {
    throw new Error('getLiquidity must be implemented by DEX class');
  }

  async getPairAddress(tokenAddress, baseTokenAddress) {
    throw new Error('getPairAddress must be implemented by DEX class');
  }

  async getReserves(tokenAddress, baseTokenAddress) {
    throw new Error('getReserves must be implemented by DEX class');
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    throw new Error('getSwapQuote must be implemented by DEX class');
  }

  // Helper methods
  async getTokenDecimals(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function decimals() view returns (uint8)'],
        this.provider
      );
      return await tokenContract.decimals();
    } catch (error) {
      console.error(`Error getting decimals for token ${tokenAddress}:`, error);
      return 18; // Default to 18 decimals
    }
  }

  async getTokenSymbol(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function symbol() view returns (string)'],
        this.provider
      );
      return await tokenContract.symbol();
    } catch (error) {
      console.error(`Error getting symbol for token ${tokenAddress}:`, error);
      return 'UNKNOWN';
    }
  }

  formatAmount(amount, decimals) {
    return ethers.utils.parseUnits(amount.toString(), decimals);
  }

  unformatAmount(amount, decimals) {
    return ethers.utils.formatUnits(amount, decimals);
  }

  // To be implemented by specific DEX classes
  async executeTrade(wallet, path, amount, minAmountOut, deadline) {
    throw new Error('Method must be implemented by subclass');
  }
}

export default BaseDex; 