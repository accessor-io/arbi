// Add this method to the Exchange class
async getTopTokens(limit = 50) {
  try {
    // First try to get from cache
    const cacheKey = `top_tokens_${this.name}_${limit}`;
    const cachedData = this.cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // If not in cache, fetch from external API
    // Different for each DEX, so we'll implement specific strategies
    const tokens = await this._fetchTopTokensByLiquidity(limit);
    
    // Cache the results for 30 minutes
    this.cache.set(cacheKey, tokens, 30 * 60);
    
    return tokens;
  } catch (error) {
    throw new Error(`Failed to get top tokens for ${this.name}: ${error.message}`);
  }
}

// This method will be overridden by specific exchange implementations
async _fetchTopTokensByLiquidity(limit) {
  throw new Error('Method _fetchTopTokensByLiquidity must be implemented by each exchange');
} 