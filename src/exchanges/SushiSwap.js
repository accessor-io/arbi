import { ethers } from 'ethers';
import BaseDex from './BaseDex.js';

class SushiSwap extends BaseDex {
  constructor(provider, config = {}) {
    super(provider, {
      name: 'SushiSwap',
      version: 'v2',
      routerAddress: config.routerAddress || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      factoryAddress: config.factoryAddress || '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      ...config
    });

    // SushiSwap Router ABI (same as Uniswap V2)
    this.routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    // SushiSwap Factory ABI (same as Uniswap V2)
    this.factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ];

    // SushiSwap Pair ABI (same as Uniswap V2)
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
}

export default SushiSwap; 