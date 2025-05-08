import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Provider configuration
const providerConfig = {
  timeout: 30000, // 30 seconds
  batchMaxCount: 100,
  batchStallTime: 10,
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000
  }
};

// Fallback RPCs for better reliability
const mainnetRPCs = [
  process.env.ETH_MAINNET_RPC,
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com'
].filter(Boolean); // Remove any undefined/null values

// Create a provider with fallback support
const createProvider = (rpcUrls) => {
  const providers = rpcUrls.map(url => 
    new ethers.JsonRpcProvider(url, undefined, providerConfig)
  );

  // Create a fallback provider that will try each RPC in sequence
  return new ethers.FallbackProvider(
    providers.map((provider, index) => ({
      provider,
      priority: index,
      stallTimeout: 30000
    }))
  );
};

// Providers setup
export const providers = {
  mainnet: createProvider(mainnetRPCs)
};

// Wallet setup
export const setupWallet = () => {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('Private key not found in environment variables');
  }
  return new ethers.Wallet(process.env.PRIVATE_KEY, providers.mainnet);
};

export const config = {
  networkId: 1, // Ethereum mainnet
  gasLimit: 300000,
  defaultSlippage: 0.5, // 0.5% slippage tolerance
};

export default {
  providers,
  setupWallet,
  ...config
};
    