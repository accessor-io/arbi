import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import RPCProvider from '../services/RPCProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common DEX ABIs
const COMMON_ABIS = {
  uniswap: [
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        }
      ],
      "name": "getAmountsOut",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        }
      ],
      "name": "getAmountsIn",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactTokensForTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
};

class BaseDex {
  constructor(provider, config = {}) {
    if (!provider) {
      throw new Error('Provider is required');
    }
    // Use the provider directly if it's not an RPCProvider
    if (provider instanceof RPCProvider) {
      this.rpcProvider = provider;
      this.provider = this.rpcProvider.getProvider(config.network || 'ethereum');
    } else {
      this.rpcProvider = null;
      this.provider = provider;
    }
    this.config = {
      routerAddress: config.routerAddress,
      factoryAddress: config.factoryAddress,
      name: config.name || 'BaseDex',
      version: config.version || 'v2',
      network: config.network || 'ethereum',
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

  async loadABI() {
    if (this.abiLoaded) return;

    try {
      // First try to load from local ABI file
      const abiPath = path.join(__dirname, 'abis', `${this.name.toLowerCase()}.json`);
      let abi;

      if (fs.existsSync(abiPath)) {
        const abiData = await fs.promises.readFile(abiPath, 'utf8');
        abi = JSON.parse(abiData);
      } else {
        // Fallback to common ABIs
        abi = COMMON_ABIS[this.name.toLowerCase()] || COMMON_ABIS.uniswap;
      }

      if (!abi) {
        throw new Error(`No ABI found for ${this.name}`);
      }

      this.routerContract = new ethers.Contract(
        this.config.routerAddress,
        abi,
        this.provider
      );

      this.abiLoaded = true;
      console.log(`Successfully loaded ABI for ${this.name}`);
    } catch (error) {
      console.error(`Failed to load ABI for ${this.name}:`, error);
      throw error;
    }
  }

  async fetchABIFromMultipleSources() {
    // Try Etherscan first
    try {
      const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
      if (etherscanApiKey) {
        const response = await axios.get(
          `https://api.etherscan.io/api?module=contract&action=getabi&address=${this.config.routerAddress}&apikey=${etherscanApiKey}`
        );
        
        if (response.data.status === '1') {
          return JSON.parse(response.data.result);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch ABI from Etherscan:`, error.message);
    }

    // Try 4byte.directory
    try {
      const response = await axios.get(
        `https://www.4byte.directory/api/v1/signatures/?hex_signature=${this.config.routerAddress}`
      );
      if (response.data && response.data.results && response.data.results.length > 0) {
        return response.data.results[0].text_signature;
      }
    } catch (error) {
      console.warn(`Failed to fetch ABI from 4byte:`, error.message);
    }

    // Try Sourcify
    try {
      const response = await axios.get(
        `https://sourcify.dev/server/verify/${this.config.routerAddress}`
      );
      if (response.data && response.data.abi) {
        return response.data.abi;
      }
    } catch (error) {
      console.warn(`Failed to fetch ABI from Sourcify:`, error.message);
    }

    // Fallback to common ABIs
    return COMMON_ABIS[this.name.toLowerCase()] || COMMON_ABIS.uniswap;
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