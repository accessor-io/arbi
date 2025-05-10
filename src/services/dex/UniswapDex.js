class UniswapDex extends BaseDex {
  constructor(provider, config) {
    super(provider, config);
    this.name = 'Uniswap';
  }

  async getPairs() {
    try {
      const factory = new ethers.Contract(
        this.config.factoryAddress,
        [
          'function allPairsLength() view returns (uint256)',
          'function allPairs(uint256) view returns (address)'
        ],
        this.provider
      );

      const pairsLength = await factory.allPairsLength();
      const pairs = [];
      
      // Fetch first 100 pairs to start
      const batchSize = 100;
      const endIndex = Math.min(pairsLength.toNumber(), batchSize);
      
      for (let i = 0; i < endIndex; i++) {
        try {
          const pairAddress = await factory.allPairs(i);
          const pairContract = new ethers.Contract(
            pairAddress,
            [
              'function token0() view returns (address)',
              'function token1() view returns (address)',
              'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
            ],
            this.provider
          );

          const [token0, token1, reserves] = await Promise.all([
            pairContract.token0(),
            pairContract.token1(),
            pairContract.getReserves()
          ]);

          // Only include pairs with non-zero reserves
          if (reserves.reserve0.gt(0) && reserves.reserve1.gt(0)) {
            pairs.push({
              address: pairAddress,
              token0,
              token1,
              reserve0: reserves.reserve0,
              reserve1: reserves.reserve1,
              dex: this.name
            });
          }
        } catch (error) {
          logger.debug(`Error fetching pair ${i} from ${this.name}:`, error.message);
          continue;
        }
      }

      logger.info(`[${this.name}] Fetched ${pairs.length} pairs`);
      return pairs;
    } catch (error) {
      logger.error(`Error fetching pairs from ${this.name}:`, error);
      return [];
    }
  }
}

module.exports = UniswapDex; 