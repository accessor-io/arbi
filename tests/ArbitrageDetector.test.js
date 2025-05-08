import { expect } from 'chai';
import { ethers } from 'ethers';
import DexAggregator from '../src/services/DexAggregator.js';
import ArbitrageDetector from '../src/core/ArbitrageDetector.js';

describe('ArbitrageDetector (DexAggregator real implementation)', () => {
  let arbitrageDetector;
  let dexAggregator;
  let tokenManager;

  // Use a real provider (can be a local node or public RPC, but here we use a dummy for structure)
  const provider = new ethers.providers.JsonRpcProvider();

  beforeEach(() => {
    // Real DexAggregator instance (UniswapV2 and SushiSwap will be initialized if their classes exist)
    dexAggregator = new DexAggregator(provider, {});

    // Realistic token manager for testnet/mainnet tokens
    tokenManager = {
      getCommonPairs: () => [
        // Use real token addresses for a supported network (e.g., Ethereum mainnet WETH/DAI)
        { base: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', quote: '0x6B175474E89094C44Da98b954EedeAC495271d0F' }
      ],
      loadToken: async (address) => {
        // Minimal token info for WETH/DAI
        if (address.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
          return { address, symbol: 'WETH', decimals: 18 };
        }
        if (address.toLowerCase() === '0x6b175474e89094c44da98b954eedeac495271d0f') {
          return { address, symbol: 'DAI', decimals: 18 };
        }
        return null;
      }
    };

    arbitrageDetector = new ArbitrageDetector(dexAggregator, tokenManager);
  });

  it('should run with real DexAggregator and return opportunities or none', async function () {
    this.timeout(20000); // Allow for real network calls

    await arbitrageDetector.findArbitrageOpportunities();
    const opportunities = arbitrageDetector.getOpportunities();

    // We can't guarantee an arbitrage exists, but the call should succeed and return an array
    expect(opportunities).to.be.an('array');
    // If there are opportunities, they should have the expected structure
    if (opportunities.length > 0) {
      expect(opportunities[0]).to.have.property('buy');
      expect(opportunities[0]).to.have.property('sell');
      expect(opportunities[0]).to.have.property('profitPercent');
    }
  });
});