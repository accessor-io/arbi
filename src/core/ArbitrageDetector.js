import pkg from 'ethers';
const { ethers, parseUnits } = pkg;
import { logger } from '../utils/logger.js';
import { BigNumber } from 'ethers';
import { ERRORS, DEFAULTS } from '../constants/index.js';
import * as Types from '../types/index.js';
import IService from '../interfaces/IService.js';

const { PriceQuote, ArbitrageOpportunity } = Types;

/**
 * Detects arbitrage opportunities by comparing prices from an aggregated source.
 * @extends {IService}
 */
export default class ArbitrageDetector extends IService {
  /**
   * Creates an instance of ArbitrageDetector.
   * @param {object} aggregatorService - Service that provides aggregated quotes across multiple sources
   * @param {object} tokenManager - Service for managing token information
   */
  constructor(aggregatorService, tokenManager) {
    super();
    
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
    this.MIN_PROFIT_THRESHOLD = parseFloat(process.env.MIN_ARBITRAGE_PROFIT_PERCENT || '0.5') / 100;
    this.SLIPPAGE_TOLERANCE = parseFloat(process.env.AGGREGATOR_SLIPPAGE_PERCENT || DEFAULTS.SLIPPAGE_TOLERANCE);
    this.BIGNUMBER_PRECISION = 36;

    logger.info(`[ArbitrageDetector] Initialized with Min Profit: ${this.MIN_PROFIT_THRESHOLD * 100}%`);
  }

  /**
   * Initialize the detector
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      logger.info('[ArbitrageDetector] Starting initialization...');

      // Validate services
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
   * Find arbitrage opportunities across configured sources
   * @returns {Promise<ArbitrageOpportunity[]>} List of profitable opportunities
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
    return this.getOpportunities();
  }

  /**
   * Analyze a specific token pair for arbitrage opportunities
   * @param {string} tokenAAddress - Address of the base token
   * @param {string} tokenBAddress - Address of the quote token
   * @returns {Promise<ArbitrageOpportunity|null>} Arbitrage opportunity if found
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
        return null;
      }
      if (!tokenA.decimals || !tokenB.decimals) {
        logger.warn(`[ArbitrageDetector] Missing decimals for tokens ${tokenA?.symbol || tokenAAddress} or ${tokenB?.symbol || tokenBAddress}. Skipping pair.`);
        return null;
      }
    } catch (error) {
      logger.error(`[ArbitrageDetector] Failed to load token details for ${tokenAAddress}/${tokenBAddress}: ${error.message}`);
      return null;
    }

    // Define test amounts
    const testAmountsWei = [
      ethers.utils.parseUnits('1', tokenA.decimals),
      ethers.utils.parseUnits('10', tokenA.decimals)
    ];

    for (const amountInWei of testAmountsWei) {
      let quotes;
      const amountInReadable = ethers.utils.formatUnits(amountInWei, tokenA.decimals);
      try {
        quotes = await this.aggregatorService.getQuotes({
          tokenIn: tokenAAddress,
          tokenOut: tokenBAddress,
          amountIn: amountInWei.toString(),
          slippagePercentage: this.SLIPPAGE_TOLERANCE
        });
      } catch (error) {
        logger.error(`[ArbitrageDetector] Aggregator error fetching quotes for ${tokenA.symbol}/${tokenB.symbol} (Amount: ${amountInReadable} ${tokenA.symbol}): ${error.message}`);
        continue;
      }

      // Filter valid quotes
      const validQuotes = quotes.filter(q =>
        q && q.source && typeof q.price === 'string' && typeof q.amountOut === 'string' &&
        ethers.getBigInt(q.amountOut) > 0n
      );

      if (validQuotes.length < 2) {
        continue;
      }

      // Convert to BigNumber for calculations
      const quotesWithBigNumbers = validQuotes.map(q => ({
        ...q,
        priceBn: ethers.parseUnits(q.price, tokenB.decimals),
        amountOutBn: ethers.getBigInt(q.amountOut)
      }));

      // Find best buy and sell quotes
      quotesWithBigNumbers.sort((a, b) => b.priceBn > a.priceBn ? 1 : -1);
      const bestSellQuote = quotesWithBigNumbers[0];

      quotesWithBigNumbers.sort((a, b) => a.priceBn > b.priceBn ? 1 : -1);
      const bestBuyQuote = quotesWithBigNumbers[0];

      if (bestSellQuote.source === bestBuyQuote.source) {
        continue;
      }

      // Calculate profit
      const sellPriceBn = bestSellQuote.priceBn;
      const buyPriceBn = bestBuyQuote.priceBn;

      if (buyPriceBn === 0n) continue;

      const scaleFactor = 10n ** BigInt(this.BIGNUMBER_PRECISION);
      const sellPriceScaled = sellPriceBn * scaleFactor;
      const profitRatioScaled = sellPriceScaled / buyPriceBn;

      const oneScaled = 1n * scaleFactor;
      const minProfitScaled = scaleFactor * BigInt(Math.round(this.MIN_PROFIT_THRESHOLD * 10000)) / 10000n;
      const requiredRatioScaled = oneScaled + minProfitScaled;

      if (profitRatioScaled > requiredRatioScaled) {
        const opportunity = {
          buyDex: bestBuyQuote.source,
          sellDex: bestSellQuote.source,
          tokenIn: tokenAAddress,
          tokenOut: tokenBAddress,
          amountIn: amountInWei.toString(),
          amountOut: bestSellQuote.amountOut,
          profit: (bestSellQuote.amountOutBn - bestBuyQuote.amountOutBn).toString(),
          profitPercentage: Number(profitRatioScaled - oneScaled) / Number(scaleFactor) * 100,
          gasEstimate: '0' // TODO: Implement gas estimation
        };

        this.opportunities.push(opportunity);
        logger.info(`[ArbitrageDetector] Found opportunity: ${opportunity.profitPercentage.toFixed(2)}% profit`);
        return opportunity;
      }
    }

    return null;
  }

  /**
   * Get all found opportunities
   * @returns {ArbitrageOpportunity[]} Sorted list of opportunities
   */
  getOpportunities() {
    return this.opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  /**
   * Set minimum profit threshold
   * @param {number} threshold - Minimum profit percentage
   */
  setMinProfitThreshold(threshold) {
    if (typeof threshold !== 'number' || threshold < 0) {
      throw new Error('Invalid profit threshold');
    }
    this.MIN_PROFIT_THRESHOLD = threshold / 100;
    logger.info(`[ArbitrageDetector] Updated min profit threshold to ${threshold}%`);
  }

  /**
   * Set maximum slippage tolerance
   * @param {number} slippage - Maximum slippage percentage
   */
  setMaxSlippage(slippage) {
    if (typeof slippage !== 'number' || slippage < 0 || slippage > 100) {
      throw new Error('Invalid slippage value');
    }
    this.SLIPPAGE_TOLERANCE = slippage;
    logger.info(`[ArbitrageDetector] Updated max slippage to ${slippage}%`);
  }

  /**
   * Get service status
   * @returns {Promise<ServiceStatus>} Current service status
   */
  async getStatus() {
    return {
      isRunning: true,
      isInitialized: true,
      metrics: {
        opportunitiesFound: this.opportunities.length,
        minProfitThreshold: this.MIN_PROFIT_THRESHOLD * 100,
        maxSlippage: this.SLIPPAGE_TOLERANCE
      },
      lastUpdate: new Date()
    };
  }

  async scanForCommonPairs() {
    const commonPairs = this.tokenManager.getCommonPairs(10); // Scan for 10 pairs
    logger.info(`[ArbitrageDetector] Starting scan for ${commonPairs.length} common pairs.`);
    for (const pair of commonPairs) {
      await this.analyzeTokenPair(pair.token0, pair.token1);
    }
    logger.info(`[ArbitrageDetector] Scan complete. Found ${this.opportunities.length} potential opportunities.`);
  }
}