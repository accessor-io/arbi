import { ethers } from 'ethers';
import BaseDex from './BaseDex.js';

class UniswapV2 extends BaseDex {
  constructor(provider, config = {}) {
    super(provider, {
      name: 'Uniswap V2',
      version: 'v2',
      routerAddress: config.routerAddress || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factoryAddress: config.factoryAddress || '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      ...config
    });

    // Uniswap V2 Router ABI
    this.routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    // Uniswap V2 Factory ABI
    this.factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ];

    // Uniswap V2 Pair ABI
    this.pairABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)'
    ];
  }

  async getPairAddress(tokenAddress, baseTokenAddress) {
    const factory = new ethers.Contract(
      this.config.factoryAddress,
      this.factoryABI,
      this.provider
    );
    return await factory.getPair(tokenAddress, baseTokenAddress);
  }

  async getReserves(tokenAddress, baseTokenAddress) {
    const pairAddress = await this.getPairAddress(tokenAddress, baseTokenAddress);
    if (pairAddress === ethers.constants.AddressZero) {
      return null;
    }

    const pair = new ethers.Contract(pairAddress, this.pairABI, this.provider);
    const [token0, token1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves()
    ]);

    const isToken0 = tokenAddress.toLowerCase() === token0.toLowerCase();
    return {
      reserve0: reserves[0],
      reserve1: reserves[1],
      token0,
      token1,
      isToken0
    };
  }

  async getTokenPrice(tokenAddress, baseTokenAddress, amount) {
    try {
      const router = new ethers.Contract(
        this.config.routerAddress,
        this.routerABI,
        this.provider
      );

      const path = [tokenAddress, baseTokenAddress];
      const amounts = await router.getAmountsOut(amount, path);

      return {
        price: amounts[1],
        amountOut: amounts[1],
        buyPrice: amounts[1],
        sellPrice: amounts[1]
      };
    } catch (error) {
      console.error(`Error getting price from ${this.name}:`, error);
      return null;
    }
  }

  async getLiquidity(tokenAddress, baseTokenAddress) {
    const reserves = await this.getReserves(tokenAddress, baseTokenAddress);
    if (!reserves) {
      return null;
    }

    const tokenDecimals = await this.getTokenDecimals(tokenAddress);
    const baseTokenDecimals = await this.getTokenDecimals(baseTokenAddress);

    return {
      tokenReserve: this.unformatAmount(reserves.isToken0 ? reserves.reserve0 : reserves.reserve1, tokenDecimals),
      baseTokenReserve: this.unformatAmount(reserves.isToken0 ? reserves.reserve1 : reserves.reserve0, baseTokenDecimals)
    };
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    try {
      const router = new ethers.Contract(
        this.config.routerAddress,
        this.routerABI,
        this.provider
      );

      const path = [tokenIn, tokenOut];
      const amounts = await router.getAmountsOut(amountIn, path);

      return {
        amountIn,
        amountOut: amounts[1],
        path
      };
    } catch (error) {
      console.error(`Error getting swap quote from ${this.name}:`, error);
      return null;
    }
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
          console.debug(`Error fetching pair ${i} from ${this.name}:`, error.message);
          continue;
        }
      }

      console.info(`[${this.name}] Fetched ${pairs.length} pairs`);
      return pairs;
    } catch (error) {
      console.error(`Error fetching pairs from ${this.name}:`, error);
      return [];
    }
  }
}

export default UniswapV2; 