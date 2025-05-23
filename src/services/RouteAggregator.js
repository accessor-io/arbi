import { ethers } from 'ethers';
import DexAggregator from './DexAggregator.js';
import TokenManager from './utils/TokenManager.js';
import AnalyticsService from './analytics/AnalyticsService.js';

class RouteAggregator {
  /**
   * Aggregates routes from multiple DEXes, considering multi-hop paths.
   * @param {ethers.providers.Provider} provider Ethers provider instance.
   * @param {object} [config={}] Configuration options.
   * @param {number} [config.cacheTimeoutMs=30000] Cache duration for routes in milliseconds.
   * @param {number} [config.defaultMaxHops=4] Default maximum hops for route finding (recommend 1-4 for performance).
   * @param {object} [config.arbitrage] Arbitrage specific configuration.
   * @param {number} [config.arbitrage.minProfitThreshold=0.001] Minimum profit percentage (e.g., 0.001 = 0.1%) to report an opportunity.
   * @param {number} [config.arbitrage.topTokensToCheck=20] Number of top tokens (by liquidity/volume) to check for arbitrage paths.
   */
  constructor(provider, config = {}) {
    if (!provider) {
        throw new Error("Ethers provider is required for RouteAggregator.");
    }
    this.provider = provider;
    // These dependencies should ideally be injected for better testability
    this.dexAggregator = new DexAggregator(provider, {
      cacheTimeout: 30 * 1000,
      ...config.dexes
    }); // Assumes DexAggregator handles specific DEX integrations
    this.tokenManager = new TokenManager(provider); // Assumes TokenManager provides token lists, base tokens etc.
    this.routeCache = new Map();

    // --- Configuration with Defaults ---
    this.config = {
        cacheTimeoutMs: config.cacheTimeoutMs || 30 * 1000, // 30 seconds cache
        // Limit default max hops to prevent excessive computation time
        defaultMaxHops: Math.max(1, Math.min(config.defaultMaxHops || 4, 4)),
        arbitrage: {
            minProfitThreshold: config.arbitrage?.minProfitThreshold || 0.001, // 0.1% default profit threshold
            topTokensToCheck: config.arbitrage?.topTokensToCheck || 20, // Check top 20 tokens for opportunities
        }
    };
    console.log("RouteAggregator initialized with config:", this.config);

    // Initialize analytics service
    this.analyticsService = new AnalyticsService(config.configService);
    // Note: We'll initialize analytics in the initialize() method
  }

  /**
   * Initialize the RouteAggregator and its dependencies
   */
  async initialize() {
    await this.analyticsService.initialize();
    return this;
  }

  /**
   * Finds the best route for swapping tokenIn to tokenOut.
   * Considers direct routes and multi-hop routes up to maxHops.
   * Uses caching to speed up repeated requests.
   * @param {string} tokenIn Address of the input token.
   * @param {string} tokenOut Address of the output token.
   * @param {string} amountIn Amount of tokenIn to swap (string representation of integer/wei).
   * @param {number} [maxHops] Maximum number of hops allowed (1 to 4). Defaults to `this.config.defaultMaxHops`.
   * @returns {Promise<object|null>} The best route found (including hops, totalAmountOut, profitPercent) or null if no route found or error.
   */
  async findBestRoute(tokenIn, tokenOut, amountIn, maxHops = this.config.defaultMaxHops) {
    // --- Input Validation ---
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
        console.error("findBestRoute Error: Invalid token address provided."); return null;
    }
    // Normalize addresses for comparison and caching
    tokenIn = ethers.getAddress(tokenIn);
    tokenOut = ethers.getAddress(tokenOut);

    if (tokenIn === tokenOut) {
        console.warn("findBestRoute Warning: Input and output tokens are the same."); return null;
    }
    let inputAmountBN;
    try {
        inputAmountBN = ethers.getBigInt(amountIn);
        if (inputAmountBN <= 0n) { console.error("findBestRoute Error: Amount must be positive."); return null; }
    } catch (e) {
        console.error("findBestRoute Error: Invalid amountIn provided:", amountIn, e.message); return null;
    }
    // Enforce maxHops limit for performance
    if (typeof maxHops !== 'number' || maxHops < 1 || maxHops > 4) {
        console.warn(`findBestRoute Warning: Invalid maxHops (${maxHops}). Clamping to range [1, 4].`);
        maxHops = Math.max(1, Math.min(maxHops, 4));
    }

    // --- Caching ---
    const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}-${maxHops}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeoutMs) {
      // console.log(`Cache hit for ${cacheKey}`);
      return cached.data;
    }
    // console.log(`Cache miss for ${cacheKey}, finding route up to ${maxHops} hops...`);

    try {
      const allRoutes = [];

      // --- Helper to build hop object (stores amounts as strings) ---
      const buildHop = (dex, tIn, tOut, amtIn, amtOut) => ({
        dex, tokenIn: tIn, tokenOut: tOut, amountIn: amtIn.toString(), amountOut: amtOut.toString()
      });

      // --- 1 Hop (Direct Route) ---
      if (maxHops >= 1) {
          try {
              const directPrice = await this.dexAggregator.getBestPrice(tokenIn, tokenOut, inputAmountBN.toString());
              if (directPrice?.bestBuy?.amountOut) {
                  const directAmountOutBN = ethers.getBigInt(directPrice.bestBuy.amountOut);
                  if (directAmountOutBN > 0n) {
                      allRoutes.push({
                          hops: [buildHop(directPrice.bestBuy.dex, tokenIn, tokenOut, inputAmountBN, directAmountOutBN)],
                          totalAmountOut: directAmountOutBN.toString(),
                      });
                  }
              }
          } catch(error) {
              // Log only if it's not a typical 'no pool' error
              if (!error.message?.includes('No pool') && !error.message?.includes('liquidity')) {
                console.warn(`Error finding direct route ${tokenIn} -> ${tokenOut}: ${error.message}`);
              }
          }
      }

      // --- Intermediate Tokens (fetch only if needed) ---
      let intermediateTokens = [];
      if (maxHops > 1) {
          intermediateTokens = await this.getIntermediateTokens(tokenIn, tokenOut);
      }

      // --- 2 Hops (tokenIn -> intermediate1 -> tokenOut) ---
      if (maxHops >= 2 && intermediateTokens.length > 0) {
        for (const intermediate1 of intermediateTokens) {
          try {
            const hop1 = await this.dexAggregator.getBestPrice(tokenIn, intermediate1, inputAmountBN.toString());
            if (!hop1?.bestBuy?.amountOut) continue;
            const amountHop1Out = ethers.getBigInt(hop1.bestBuy.amountOut);
            if (amountHop1Out <= 0n) continue;

            const hop2 = await this.dexAggregator.getBestPrice(intermediate1, tokenOut, amountHop1Out.toString());
            if (!hop2?.bestBuy?.amountOut) continue;
            const amountHop2Out = ethers.getBigInt(hop2.bestBuy.amountOut);
            if (amountHop2Out <= 0n) continue;

            allRoutes.push({
              hops: [
                buildHop(hop1.bestBuy.dex, tokenIn, intermediate1, inputAmountBN, amountHop1Out),
                buildHop(hop2.bestBuy.dex, intermediate1, tokenOut, amountHop1Out, amountHop2Out)
              ],
              totalAmountOut: amountHop2Out.toString(),
            });
          } catch (error) {
            if (!error.message?.includes('No pool') && !error.message?.includes('liquidity')) {
                 console.warn(`Error finding 2-hop route via ${intermediate1}: ${error.message}`);
            }
          }
        }
      }

      // --- 3 Hops (tokenIn -> intermediate1 -> intermediate2 -> tokenOut) ---
      if (maxHops >= 3 && intermediateTokens.length > 0) {
          // Pre-calculate first hops where possible to reduce redundant calls
          const firstHopResults = new Map();
          for (const intermediate1 of intermediateTokens) {
              try {
                  const hop1 = await this.dexAggregator.getBestPrice(tokenIn, intermediate1, inputAmountBN.toString());
                  if (hop1?.bestBuy?.amountOut) {
                      const amountHop1Out = ethers.getBigInt(hop1.bestBuy.amountOut);
                      if (amountHop1Out > 0n) {
                          firstHopResults.set(intermediate1, { dex: hop1.bestBuy.dex, amountOut: amountHop1Out });
                      }
                  }
              } catch (error) { /* Ignore errors here, handled in inner loop */ }
          }

          for (const [intermediate1, hop1Result] of firstHopResults.entries()) {
              const amountHop1Out = hop1Result.amountOut;
              for (const intermediate2 of intermediateTokens) {
                  if (intermediate1 === intermediate2) continue; // Avoid A->B->B->C
                  try {
                      const hop2 = await this.dexAggregator.getBestPrice(intermediate1, intermediate2, amountHop1Out.toString());
                      if (!hop2?.bestBuy?.amountOut) continue;
                      const amountHop2Out = ethers.getBigInt(hop2.bestBuy.amountOut);
                      if (amountHop2Out <= 0n) continue;

                      const hop3 = await this.dexAggregator.getBestPrice(intermediate2, tokenOut, amountHop2Out.toString());
                      if (!hop3?.bestBuy?.amountOut) continue;
                      const amountHop3Out = ethers.getBigInt(hop3.bestBuy.amountOut);
                      if (amountHop3Out <= 0n) continue;

                      allRoutes.push({
                          hops: [
                              buildHop(hop1Result.dex, tokenIn, intermediate1, inputAmountBN, amountHop1Out),
                              buildHop(hop2.bestBuy.dex, intermediate1, intermediate2, amountHop1Out, amountHop2Out),
                              buildHop(hop3.bestBuy.dex, intermediate2, tokenOut, amountHop2Out, amountHop3Out)
                          ],
                          totalAmountOut: amountHop3Out.toString(),
                      });
                  } catch (error) {
                      if (!error.message?.includes('No pool') && !error.message?.includes('liquidity')) {
                          console.warn(`Error finding 3-hop route via ${intermediate1}->${intermediate2}: ${error.message}`);
                      }
                  }
              }
          }
      }

      // --- 4 Hops (tokenIn -> i1 -> i2 -> i3 -> tokenOut) ---
      if (maxHops >= 4 && intermediateTokens.length > 0) {
          // Pre-calculate first and second hops to reduce redundant calls further
          const firstHopResults = new Map(); // As calculated for 3 hops
          for (const intermediate1 of intermediateTokens) {
              try {
                  const hop1 = await this.dexAggregator.getBestPrice(tokenIn, intermediate1, inputAmountBN.toString());
                  if (hop1?.bestBuy?.amountOut) {
                      const amountHop1Out = ethers.getBigInt(hop1.bestBuy.amountOut);
                      if (amountHop1Out > 0n) {
                          firstHopResults.set(intermediate1, { dex: hop1.bestBuy.dex, amountOut: amountHop1Out });
                      }
                  }
              } catch (error) { /* Ignore */ }
          }

          const secondHopResults = new Map(); // Key: intermediate1-intermediate2
          for (const [intermediate1, hop1Result] of firstHopResults.entries()) {
              for (const intermediate2 of intermediateTokens) {
                  if (intermediate1 === intermediate2) continue;
                  try {
                      const hop2 = await this.dexAggregator.getBestPrice(intermediate1, intermediate2, hop1Result.amountOut.toString());
                      if (hop2?.bestBuy?.amountOut) {
                          const amountHop2Out = ethers.getBigInt(hop2.bestBuy.amountOut);
                          if (amountHop2Out > 0n) {
                              secondHopResults.set(`${intermediate1}-${intermediate2}`, {
                                  hop1Dex: hop1Result.dex,
                                  hop1AmountOut: hop1Result.amountOut,
                                  hop2Dex: hop2.bestBuy.dex,
                                  hop2AmountOut: amountHop2Out
                              });
                          }
                      }
                  } catch (error) { /* Ignore */ }
              }
          }

          for (const [hopKey, hop2Result] of secondHopResults.entries()) {
              const [intermediate1, intermediate2] = hopKey.split('-');
              const amountHop2Out = hop2Result.hop2AmountOut;

              for (const intermediate3 of intermediateTokens) {
                  // Avoid cycles within the 4 hops
                  if (intermediate3 === intermediate1 || intermediate3 === intermediate2) continue;
                  try {
                      const hop3 = await this.dexAggregator.getBestPrice(intermediate2, intermediate3, amountHop2Out.toString());
                      if (!hop3?.bestBuy?.amountOut) continue;
                      const amountHop3Out = ethers.getBigInt(hop3.bestBuy.amountOut);
                      if (amountHop3Out <= 0n) continue;

                      const hop4 = await this.dexAggregator.getBestPrice(intermediate3, tokenOut, amountHop3Out.toString());
                      if (!hop4?.bestBuy?.amountOut) continue;
                      const amountHop4Out = ethers.getBigInt(hop4.bestBuy.amountOut);
                      if (amountHop4Out <= 0n) continue;

                      allRoutes.push({
                          hops: [
                              buildHop(hop2Result.hop1Dex, tokenIn, intermediate1, inputAmountBN, hop2Result.hop1AmountOut),
                              buildHop(hop2Result.hop2Dex, intermediate1, intermediate2, hop2Result.hop1AmountOut, amountHop2Out),
                              buildHop(hop3.bestBuy.dex, intermediate2, intermediate3, amountHop2Out, amountHop3Out),
                              buildHop(hop4.bestBuy.dex, intermediate3, tokenOut, amountHop3Out, amountHop4Out)
                          ],
                          totalAmountOut: amountHop4Out.toString(),
                      });
                  } catch (error) {
                      if (!error.message?.includes('No pool') && !error.message?.includes('liquidity')) {
                          console.warn(`Error finding 4-hop route via ${intermediate1}->${intermediate2}->${intermediate3}: ${error.message}`);
                      }
                  }
              }
          }
      }

      // --- Find Best Route ---
      if (allRoutes.length === 0) {
        // console.warn(`No viable route found for ${tokenIn} -> ${tokenOut} with amount ${amountIn} up to ${maxHops} hops`);
        this.routeCache.set(cacheKey, { timestamp: Date.now(), data: null });
        return null;
      }

      const bestRoute = allRoutes.reduce((best, current) => {
        const currentAmountBN = ethers.getBigInt(current.totalAmountOut || '0');
        const bestAmountBN = ethers.getBigInt(best.totalAmountOut || '0');
        return currentAmountBN > bestAmountBN ? current : best;
      }, { totalAmountOut: '0' });

      // --- Calculate Profit Percentage ---
      const outputAmountBN = ethers.getBigInt(bestRoute.totalAmountOut);
      bestRoute.profitPercent = 0; // Default
      try {
          const outputFloat = Number(ethers.formatUnits(outputAmountBN, 0)); // Simplistic: formatUnits without decimals
          const inputFloat = Number(ethers.formatUnits(inputAmountBN, 0));   // Simplistic: formatUnits without decimals
          if (!isNaN(outputFloat) && !isNaN(inputFloat) && inputFloat !== 0) {
              bestRoute.profitPercent = (outputFloat / inputFloat) - 1;
          }
      } catch (formatError) {
          console.error("Error calculating profit percentage:", formatError);
      }

      // --- Cache Result ---
      this.routeCache.set(cacheKey, {
        timestamp: Date.now(),
        data: bestRoute
      });
      // console.log(`Found best route for ${cacheKey}:`, bestRoute);

      return bestRoute;

    } catch (error) {
      console.error(`Critical error in findBestRoute for ${tokenIn} -> ${tokenOut}:`, error);
      this.routeCache.delete(cacheKey);
      return null;
    }
  }

  /**
   * Gets a list of potential intermediate tokens for routing.
   * Excludes the input and output tokens. Can be customized.
   * @param {string} tokenIn Address of the input token.
   * @param {string} tokenOut Address of the output token.
   * @returns {Promise<string[]>} A list of intermediate token addresses (checksummed).
   */
  async getIntermediateTokens(tokenIn, tokenOut) {
    const baseToken = this.tokenManager.getBaseTokenAddress(); // e.g., WETH, WBNB
    // Consider making the number of popular tokens configurable
    const popularTokens = await this.tokenManager.getTopTokens(10);

    const intermediates = new Set();
    if (baseToken) {
        try { intermediates.add(ethers.getAddress(baseToken)); } catch (e) { /* ignore invalid base token */ }
    }
    popularTokens.forEach(t => {
        try { intermediates.add(ethers.getAddress(t.address)); } catch (e) { /* ignore invalid popular token */ }
    });

    // Add common stablecoins (ensure addresses are correct for the network)
    // Example: const USDC = '...'; const USDT = '...';
    // try { intermediates.add(ethers.getAddress(USDC)); } catch(e){}
    // try { intermediates.add(ethers.getAddress(USDT)); } catch(e){}

    // Ensure input and output tokens (checksummed) are not included
    const checksumIn = ethers.getAddress(tokenIn);
    const checksumOut = ethers.getAddress(tokenOut);
    intermediates.delete(checksumIn);
    intermediates.delete(checksumOut);

    return Array.from(intermediates);
  }

  /**
   * Finds potential cyclic arbitrage opportunities (e.g., StartToken -> TokenB -> StartToken).
   * @param {string} startAmount Amount of the starting token (string representation).
   * @param {string} startToken Address of the starting token (e.g., WETH, USDC).
   * @param {number} [maxHops] Max hops for each leg of the arbitrage (1-4). Defaults to `this.config.defaultMaxHops`.
   * @param {number} [minProfitThreshold] Minimum profit percentage (e.g., 0.001 for 0.1%). Defaults to `this.config.arbitrage.minProfitThreshold`.
   * @returns {Promise<Array>} A list of profitable arbitrage opportunities found, sorted by profit.
   */
  async findArbitrageOpportunities(
      startAmount,
      startToken,
      maxHops = this.config.defaultMaxHops,
      minProfitThreshold = this.config.arbitrage.minProfitThreshold
  ) {
    // --- Input Validation ---
     let initialAmountBN;
     try {
         initialAmountBN = ethers.getBigInt(startAmount);
         if (initialAmountBN <= 0n) { console.error("findArbitrageOpportunities Error: startAmount must be positive."); return []; }
     } catch (e) {
         console.error("findArbitrageOpportunities Error: Invalid startAmount:", startAmount, e.message); return [];
     }
     try {
         startToken = ethers.getAddress(startToken); // Normalize start token address
     } catch (e) {
         console.error("findArbitrageOpportunities Error: Invalid startToken address."); return [];
     }
     // Enforce maxHops limit
     if (typeof maxHops !== 'number' || maxHops < 1 || maxHops > 4) {
         console.warn(`findArbitrageOpportunities Warning: Invalid maxHops (${maxHops}). Clamping to range [1, 4].`);
         maxHops = Math.max(1, Math.min(maxHops, 4));
     }
     if (typeof minProfitThreshold !== 'number' || minProfitThreshold < 0) {
         console.warn(`findArbitrageOpportunities Warning: Invalid minProfitThreshold (${minProfitThreshold}). Using default: ${this.config.arbitrage.minProfitThreshold}`);
         minProfitThreshold = this.config.arbitrage.minProfitThreshold;
     }

    try {
        const checkTokens = await this.tokenManager.getTopTokens(this.config.arbitrage.topTokensToCheck);
        const opportunities = [];
        const checkedIntermediates = new Set();

        // Iterate through potential intermediate tokens (B in Start -> B -> Start)
        for (const intermediateTokenInfo of checkTokens) {
            let tokenB;
            try {
                tokenB = ethers.getAddress(intermediateTokenInfo.address); // Normalize intermediate token
            } catch(e) { continue; } // Skip invalid intermediate addresses

            if (tokenB === startToken || checkedIntermediates.has(tokenB)) {
                continue;
            }
            checkedIntermediates.add(tokenB);

            // console.log(`Checking arbitrage: ${startToken} -> ${tokenB} -> ${startToken}`);

            // --- First leg: startToken -> tokenB ---
            const routeAB = await this.findBestRoute(startToken, tokenB, initialAmountBN.toString(), maxHops);

            if (routeAB?.totalAmountOut) {
                const amountB_BN = ethers.getBigInt(routeAB.totalAmountOut);
                if (amountB_BN <= 0n) continue;

                // --- Second leg: tokenB -> startToken ---
                const routeBA = await this.findBestRoute(tokenB, startToken, amountB_BN.toString(), maxHops);

                if (routeBA?.totalAmountOut) {
                    const finalAmountA_BN = ethers.getBigInt(routeBA.totalAmountOut);

                    // --- Check for Profit ---
                    if (finalAmountA_BN > initialAmountBN) {
                        // Calculate profit percentage (using floating point - see warning)
                        let profitPercent = 0;
                        try {
                            const finalFloat = Number(ethers.formatUnits(finalAmountA_BN, 0)); // Simplistic
                            const initialFloat = Number(ethers.formatUnits(initialAmountBN, 0)); // Simplistic
                             if (!isNaN(finalFloat) && !isNaN(initialFloat) && initialFloat !== 0) {
                                profitPercent = (finalFloat / initialFloat) - 1;
                            }
                        } catch (formatError) {
                            console.error("Error calculating arbitrage profit percentage:", formatError);
                        }

                        // Check against threshold
                        if (profitPercent > minProfitThreshold) {
                            // console.log(`Found opportunity: ${startToken} -> ${tokenB} -> ${startToken}, Profit: ${(profitPercent * 100).toFixed(4)}%`);
                            opportunities.push({
                                type: 'cyclic',
                                path: [startToken, tokenB, startToken],
                                initialAmount: initialAmountBN.toString(),
                                intermediateAmount: amountB_BN.toString(),
                                finalAmount: finalAmountA_BN.toString(),
                                profitPercent: profitPercent,
                                routes: [routeAB, routeBA]
                            });
                        }
                    }
                } // End if routeBA exists
            } // End if routeAB exists
        } // End loop through intermediate tokens

        // Sort opportunities by profit percentage (descending)
        return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    } catch (error) {
      console.error('Critical error finding arbitrage opportunities:', error);
      return [];
    }
  }

  /**
   * Gets quotes from multiple sources for a token swap.
   * This method adapts the RouteAggregator's interface to match what ArbitrageDetector expects.
   * @param {object} params Parameters for the quote request
   * @param {string} params.tokenIn Address of the input token
   * @param {string} params.tokenOut Address of the output token
   * @param {string} params.amountIn Amount of input token in wei
   * @param {number} params.slippagePercentage Maximum allowed slippage percentage
   * @returns {Promise<Array>} Array of quotes from different sources
   */
  async getQuotes(params) {
    try {
      const { tokenIn, tokenOut, amountIn, slippagePercentage } = params;
      
      // Validate inputs
      if (!tokenIn || !tokenOut || !amountIn) {
        throw new Error('Missing required parameters for getQuotes');
      }

      // Get quotes from all DEXes
      const quotes = await Promise.all(
        Array.from(this.dexAggregator.dexes.values()).map(async (dex) => {
          try {
            const quote = await dex.getSwapQuote(tokenIn, tokenOut, amountIn);
            if (quote) {
              return {
                source: dex.name,
                price: quote.price,
                amountOut: quote.amountOut,
                path: quote.path || [tokenIn, tokenOut],
                gasEstimate: quote.gasEstimate || '0'
              };
            }
            return null;
          } catch (error) {
            console.warn(`Error getting quote from ${dex.name}:`, error.message);
            return null;
          }
        })
      );

      // Filter out null quotes and return valid ones
      return quotes.filter(q => q !== null);
    } catch (error) {
      console.error('Error in getQuotes:', error);
      return [];
    }
  }
}

export default RouteAggregator;