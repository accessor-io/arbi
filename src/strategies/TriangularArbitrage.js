import { ethers } from 'ethers';

class TriangularArbitrage {
  constructor(exchanges, tokenManager) {
    this.exchanges = exchanges;
    this.tokenManager = tokenManager;
    this.opportunities = [];
  }
  
  async findOpportunities() {
    this.opportunities = [];
    const baseToken = await this.tokenManager.loadToken('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'); // WETH
    
    // Define a series of token paths to check
    const paths = [
      {
        a: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        b: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        c: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      },
      // Add more potential triangular paths
    ];
    
    for (const path of paths) {
      await this.analyzePath(path.a, path.b, path.c);
    }
    
    return this.opportunities;
  }
  
  async analyzePath(tokenAAddress, tokenBAddress, tokenCAddress) {
    // Load tokens
    const tokenA = await this.tokenManager.loadToken(tokenAAddress);
    const tokenB = await this.tokenManager.loadToken(tokenBAddress);
    const tokenC = await this.tokenManager.loadToken(tokenCAddress);
    
    if (!tokenA || !tokenB || !tokenC) return;
    
    // For each exchange, check the round-trip conversion rate
    for (const exchange of this.exchanges) {
      try {
        // A to B
        const aToBResult = await exchange.getTokenPrice(tokenA.address, tokenB.address, ethers.utils.parseUnits('1', tokenA.decimals));
        if (!aToBResult) continue;
        
        // B to C
        const bToCResult = await exchange.getTokenPrice(tokenB.address, tokenC.address, aToBResult.sellPrice);
        if (!bToCResult) continue;
        
        // C back to A
        const cToAResult = await exchange.getTokenPrice(tokenC.address, tokenA.address, bToCResult.sellPrice);
        if (!cToAResult) continue;
        
        // Calculate profit/loss from round trip
        const startAmount = ethers.utils.parseUnits('1', tokenA.decimals);
        const endAmount = cToAResult.sellPrice;
        const profit = endAmount.sub(startAmount);
        const profitPercent = profit.mul(ethers.BigNumber.from(10000)).div(startAmount).toNumber() / 100;
        
        if (profitPercent > 0) {
          this.opportunities.push({
            type: 'triangular',
            exchange: exchange.name,
            path: [
              { symbol: tokenA.symbol, address: tokenA.address },
              { symbol: tokenB.symbol, address: tokenB.address },
              { symbol: tokenC.symbol, address: tokenC.address }
            ],
            profitPercent,
            startAmount: ethers.utils.formatUnits(startAmount, tokenA.decimals),
            endAmount: ethers.utils.formatUnits(endAmount, tokenA.decimals)
          });
        }
      } catch (error) {
        console.error(`Error analyzing triangular path on ${exchange.name}:`, error);
      }
    }
  }
}

export default TriangularArbitrage; 