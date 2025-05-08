import { ethers } from 'ethers'; // Use ES6 import
import { logger } from '../utils/logger.js';
import { BigNumber } from 'ethers';

/**
 * Detects arbitrage opportunities by comparing prices from an aggregated source.
 */
export default class ArbitrageDetector {
  /**
   * Creates an instance of ArbitrageDetector.
   * @param {object} aggregatorService - Service that provides aggregated quotes across multiple sources. Must have a `getQuotes` method.
   * @param {object} tokenManager - Service for managing token information. Must have `loadToken` and `getCommonPairs` methods.
   */
  constructor(aggregatorService, tokenManager) {
    // Validate inputs
    if (!aggregatorService || typeof aggregatorService.getQuotes !== 'function') {
      throw new Error('ArbitrageDetector requires a valid aggregatorService with a getQuotes method.');
    }
    if (!tokenManager || typeof tokenManager.loadToken !== 'function' || typeof tokenManager.getCommonPairs !== 'function') {
      throw new Error('ArbitrageDetector requires a valid tokenManager.');
    }

    this.aggregatorService = aggregatorService;
    this.tokenManager = tokenManager;
    this.opportunities = [];
    // Configurable minimum profit threshold (e.g., 0.5% -> 0.005)
    this.MIN_PROFIT_THRESHOLD = parseFloat(process.env.MIN_ARBITRAGE_PROFIT_PERCENT || '0.5') / 100;
    // Configurable slippage tolerance for aggregator quotes, if supported
    this.SLIPPAGE_TOLERANCE = parseFloat(process.env.AGGREGATOR_SLIPPAGE_PERCENT || '0.5');
    // Precision for BigNumber calculations
    this.BIGNUMBER_PRECISION = 36;

    logger.info(`[ArbitrageDetector] Initialized with Min Profit: ${this.MIN_PROFIT_THRESHOLD * 100}%`);
  }

  /**
   * Initializes the detector by validating services and preloading common token pairs.
   * @returns {Promise<boolean>} True if initialization was successful.
   */
  async initialize() {
    try {
      logger.info('[ArbitrageDetector] Starting initialization...');

      // Validate services again
      if (!this.aggregatorService || typeof this.aggregatorService.getQuotes !== 'function') {
        throw new Error('Invalid aggregatorService: missing getQuotes method');
      }
      if (!this.tokenManager || typeof this.tokenManager.loadToken !== 'function' || typeof this.tokenManager.getCommonPairs !== 'function') {
        throw new Error('Invalid tokenManager: missing required methods');
      }

      // Preload common token pairs
      const commonPairs = this.tokenManager.getCommonPairs();
      if (!commonPairs || commonPairs.length === 0) {
        logger.warn('[ArbitrageDetector] No common pairs found during initialization');
      } else {
        logger.info(`[ArbitrageDetector] Preloading ${commonPairs.length} common token pairs...`);
        for (const pair of commonPairs) {
          await Promise.all([
            this.tokenManager.loadToken(pair.base),
            this.tokenManager.loadToken(pair.quote)
          ]).catch(error => {
            logger.warn(`[ArbitrageDetector] Failed to preload token pair ${pair.base}/${pair.quote}: ${error.message}`);
          });
        }
      }

      logger.info('[ArbitrageDetector] Initialization completed successfully');
      return true;
    } catch (error) {
      logger.error('[ArbitrageDetector] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Finds arbitrage opportunities across configured sources for common token pairs.
   * @returns {Promise<Array>} A list of profitable arbitrage opportunities, sorted by profit percentage.
   */
  async findArbitrageOpportunities() {
    this.opportunities = []; // Reset opportunities for each scan
    const pairs = this.tokenManager.getCommonPairs();
    if (!pairs || pairs.length === 0) {
        logger.warn("[ArbitrageDetector] No common pairs found to analyze.");
        return [];
    }
    logger.info(`[ArbitrageDetector] Starting scan for ${pairs.length} common pairs.`);

    // Analyze pairs concurrently
    await Promise.all(pairs.map(pair =>
      this.analyzeTokenPair(pair.base, pair.quote)
        .catch(error => logger.error(`[ArbitrageDetector] Error analyzing pair ${pair.base}/${pair.quote}: ${error.message}`, { stack: error.stack }))
    ));

    logger.info(`[ArbitrageDetector] Scan complete. Found ${this.opportunities.length} potential opportunities.`);
    return this.getOpportunities(); // Return sorted opportunities
  }

  /**
   * Analyzes a specific token pair for arbitrage opportunities using the aggregator.
   * @param {string} tokenAAddress - Address of the base token (token to sell/buy).
   * @param {string} tokenBAddress - Address of the quote token (token to receive/spend).
   */
  async analyzeTokenPair(tokenAAddress, tokenBAddress) {
    let tokenA, tokenB;
    try {
      // Load token details concurrently
      [tokenA, tokenB] = await Promise.all([
        this.tokenManager.loadToken(tokenAAddress),
        this.tokenManager.loadToken(tokenBAddress)
      ]);

      if (!tokenA || !tokenB) {
        logger.warn(`[ArbitrageDetector] Could not load token details for pair ${tokenAAddress.substring(0,6)}.../${tokenBAddress.substring(0,6)}... Skipping.`);
        return;
      }
       if (!tokenA.decimals || !tokenB.decimals) {
         logger.warn(`[ArbitrageDetector] Missing decimals for tokens ${tokenA?.symbol || tokenAAddress} or ${tokenB?.symbol || tokenBAddress}. Skipping pair.`);
         return;
       }
    } catch (error) {
      logger.error(`[ArbitrageDetector] Failed to load token details for ${tokenAAddress}/${tokenBAddress}: ${error.message}`);
      return;
    }

    // Define test amounts (consider making these configurable or dynamic)
    // Using smaller amounts first reduces risk of hitting API limits or large slippage issues initially
    const testAmountsWei = [
      ethers.parseUnits('1', tokenA.decimals),
      ethers.parseUnits('10', tokenA.decimals),
      // ethers.parseUnits('50', tokenA.decimals), // Add more amounts cautiously
    ];

    for (const amountInWei of testAmountsWei) {
      let quotes;
      const amountInReadable = ethers.formatUnits(amountInWei, tokenA.decimals);
      try {
        // Fetch aggregated quotes for selling tokenA to get tokenB
        quotes = await this.aggregatorService.getQuotes({
          tokenIn: tokenAAddress,
          tokenOut: tokenBAddress,
          amountIn: amountInWei.toString(), // Pass amount as string (wei)
          slippagePercentage: this.SLIPPAGE_TOLERANCE // Pass slippage tolerance
        });

      } catch (error) {
        logger.error(`[ArbitrageDetector] Aggregator error fetching quotes for ${tokenA.symbol}/${tokenB.symbol} (Amount: ${amountInReadable} ${tokenA.symbol}): ${error.message}`);
        continue; // Skip this amount if aggregator fails
      }

      // Filter out invalid quotes (e.g., null price/amountOut, zero amountOut)
      const validQuotes = quotes.filter(q =>
          q && q.source && typeof q.price === 'string' && typeof q.amountOut === 'string' &&
          ethers.getBigInt(q.amountOut) > 0n
      );

      if (validQuotes.length < 2) {
        // Need at least two different sources for arbitrage
        continue;
      }

      // Convert string prices/amounts to BigNumber for reliable comparison and calculation
      const quotesWithBigNumbers = validQuotes.map(q => ({
          ...q,
          priceBn: ethers.parseUnits(q.price, tokenB.decimals), // Price (TokenB per TokenA) scaled to TokenB decimals
          amountOutBn: ethers.getBigInt(q.amountOut) // AmountOut (TokenB) in wei
      }));

      // Sort quotes: highest price first (best source for selling tokenA)
      quotesWithBigNumbers.sort((a, b) => b.priceBn > a.priceBn ? 1 : -1);
      const bestSellQuote = quotesWithBigNumbers[0];

      // Sort quotes: lowest price first (best source for buying tokenA)
      quotesWithBigNumbers.sort((a, b) => a.priceBn > b.priceBn ? 1 : -1);
      const bestBuyQuote = quotesWithBigNumbers[0];

      // Ensure the buy and sell sources are different
      if (bestSellQuote.source === bestBuyQuote.source) {
        continue;
      }

      // --- Profit Calculation ---
      const sellPriceBn = bestSellQuote.priceBn; // Price (TokenB/TokenA) on sell source
      const buyPriceBn = bestBuyQuote.priceBn;   // Price (TokenB/TokenA) on buy source

      if (buyPriceBn === 0n) continue; // Avoid division by zero

      // Calculate Profit Ratio = Sell Price / Buy Price using scaled BigNumbers for precision
      const scaleFactor = 10n ** BigInt(this.BIGNUMBER_PRECISION);
      const sellPriceScaled = sellPriceBn * scaleFactor; // Scale up sell price
      const profitRatioScaled = sellPriceScaled / buyPriceBn; // Calculate ratio (scaled)

      // Define the threshold ratio (1 + min_profit) scaled
      const oneScaled = 1n * scaleFactor;
      // Use integer math for threshold calculation to avoid floating point issues
      const minProfitScaled = scaleFactor * BigInt(Math.round(this.MIN_PROFIT_THRESHOLD * 10000)) / 10000n;
      const requiredRatioScaled = oneScaled + minProfitScaled;

      // Check if the actual profit ratio exceeds the required threshold ratio
      if (profitRatioScaled > requiredRatioScaled) {
        // Calculate actual profit percentage from the scaled ratio
        const profitPercent = (Number(ethers.formatUnits(profitRatioScaled, this.BIGNUMBER_PRECISION)) - 1) * 100;

        // Calculate estimated profit in TokenB
        const amountOutSellBn = bestSellQuote.amountOutBn;

        // Estimate cost to buy `amountInWei` of TokenA on the buy source using its price
        const estimatedCostBuyBn = (amountInWei * buyPriceBn) / (10n ** BigInt(tokenA.decimals));

        // Estimated Profit = amountOutSellBn - estimatedCostBuyBn (in TokenB wei)
        const estimatedProfitInTokenBW = amountOutSellBn - estimatedCostBuyBn;

        // Ensure calculated profit is positive before recording
        if (estimatedProfitInTokenBW > 0n) {
          const amountOutSellReadable = ethers.formatUnits(amountOutSellBn, tokenB.decimals);
          const estimatedProfitReadable = ethers.formatUnits(estimatedProfitInTokenBW, tokenB.decimals);
          const estimatedCostBuyReadable = ethers.formatUnits(estimatedCostBuyBn, tokenB.decimals);

          // Aggregate gas costs if available
          const estimatedGasUsd = (bestBuyQuote.estimatedGasUsd || 0) + (bestSellQuote.estimatedGasUsd || 0);

          this.opportunities.push({
            id: `${tokenA.symbol}-${tokenB.symbol}-${bestBuyQuote.source}-${bestSellQuote.source}-${Date.now()}`, // Unique ID
            timestamp: Date.now(),
            tokenA: {
              address: tokenAAddress,
              symbol: tokenA.symbol,
              amount: amountInReadable, // Amount of TokenA being traded
              decimals: tokenA.decimals
            },
            tokenB: {
              address: tokenBAddress,
              symbol: tokenB.symbol,
              decimals: tokenB.decimals
            },
            buyLeg: { // Action: Buy TokenA (implicitly by selling TokenB) on the 'bestBuyQuote' source
              source: bestBuyQuote.source,
              price: ethers.formatUnits(buyPriceBn, tokenB.decimals),
              estimatedCost: estimatedCostBuyReadable,
              estimatedGasUsd: bestBuyQuote.estimatedGasUsd || 0,
              rawQuote: bestBuyQuote.rawQuote
            },
            sellLeg: { // Action: Sell TokenA to get TokenB on the 'bestSellQuote' source
              source: bestSellQuote.source,
              price: ethers.formatUnits(sellPriceBn, tokenB.decimals),
              estimatedOutput: amountOutSellReadable,
              estimatedGasUsd: bestSellQuote.estimatedGasUsd || 0,
              rawQuote: bestSellQuote.rawQuote
            },
            profit: {
              percentage: profitPercent,
              amount: estimatedProfitReadable,
              amountUsd: null, // Would require price feed integration
              estimatedGasUsd: estimatedGasUsd
            }
          });
          logger.info(`[ArbitrageDetector] Found Opportunity: ${tokenA.symbol}/${tokenB.symbol} (${amountInReadable} ${tokenA.symbol}) | Buy@${bestBuyQuote.source} (${ethers.formatUnits(buyPriceBn, tokenB.decimals)}) / Sell@${bestSellQuote.source} (${ethers.formatUnits(sellPriceBn, tokenB.decimals)}) | Profit: ${profitPercent.toFixed(3)}% (~${estimatedProfitReadable} ${tokenB.symbol})`);
        } else {
             // Log if profit calculation resulted in non-positive value, indicating potential issues or fees > spread
             // logger.debug(`[ArbitrageDetector] Non-positive estimated profit for ${tokenA.symbol}/${tokenB.symbol} between ${bestBuyQuote.source} and ${bestSellQuote.source}. Sell Amount: ${amountOutSellReadable}, Est. Buy Cost: ${ethers.formatUnits(estimatedCostBuyBn, tokenB.decimals)}`);
        }
      }
    }
  }

  /**
   * Gets the detected opportunities, sorted by profit percentage (descending).
   * @returns {Array} Sorted list of arbitrage opportunities.
   */
  getOpportunities() {
    // Sort opportunities by profit percentage in descending order
    return [...this.opportunities].sort((a, b) => b.profit.percentage - a.profit.percentage);
  }

  /**
   * Sets the minimum profit threshold for arbitrage opportunities.
   * @param {number} threshold - The minimum profit threshold as a percentage (e.g., 0.5 for 0.5%)
   */
  setMinProfitThreshold(threshold) {
    if (typeof threshold !== 'number' || threshold < 0) {
      throw new Error('Invalid profit threshold. Must be a non-negative number.');
    }
    this.MIN_PROFIT_THRESHOLD = threshold / 100; // Convert percentage to decimal
    logger.info(`[ArbitrageDetector] Updated minimum profit threshold to ${threshold}%`);
  }

  /**
   * Sets the maximum slippage tolerance for quotes.
   * @param {number} slippage - The maximum slippage tolerance as a percentage (e.g., 0.5 for 0.5%)
   */
  setMaxSlippage(slippage) {
    if (typeof slippage !== 'number' || slippage < 0) {
      throw new Error('Invalid slippage. Must be a non-negative number.');
    }
    this.SLIPPAGE_TOLERANCE = slippage;
    logger.info(`[ArbitrageDetector] Updated slippage tolerance to ${slippage}%`);
  }

  async analyzeTokenPair(tokenIn, tokenOut, amount) {
    try {
      // Convert amount to BigNumber
      const amountIn = BigNumber.from(amount.toString());
      
      // Get direct route
      const directRoute = await this.findDirectRoute(tokenIn, tokenOut, amountIn);
      if (!directRoute) return null;

      // Get reverse route
      const reverseRoute = await this.findDirectRoute(tokenOut, tokenIn, directRoute.amountOut);
      if (!reverseRoute) return null;

      // Calculate profit
      const profit = reverseRoute.amountOut.sub(amountIn);
      const profitPercentage = profit.mul(10000).div(amountIn).toNumber() / 100;

      if (profitPercentage >= this.MIN_PROFIT_THRESHOLD) {
        return {
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString(),
          amountOut: directRoute.amountOut.toString(),
          reverseAmountIn: directRoute.amountOut.toString(),
          reverseAmountOut: reverseRoute.amountOut.toString(),
          profit: profit.toString(),
          profitPercentage,
          path: directRoute.path,
          reversePath: reverseRoute.path
        };
      }

      return null;
    } catch (error) {
      console.error(`Error analyzing token pair ${tokenIn} -> ${tokenOut}:`, error);
      return null;
    }
  }

  async findDirectRoute(tokenA, tokenB, amountIn) {
    try {
      // Implementation of route finding logic
      // Make sure all numeric values are handled as BigNumber
      const amount = BigNumber.from(amountIn.toString());
      
      // Your route finding logic here
      // Always use BigNumber for calculations
      
      return {
        path: [tokenA, tokenB],
        amountIn: amount,
        amountOut: amount // Replace with actual calculation
      };
    } catch (error) {
      console.error(`Error finding direct route ${tokenA} -> ${tokenB}:`, error);
      return null;
    }
  }
}