/**
 * Test file to verify ES modules are working correctly
 */

// Test imports from various locations
import priceService from './services/exchange/priceService.js';
import arbitrageService from './services/arbitrage/ArbitrageService.js';

// Export a simple test function
export async function runTests() {
  console.log('Running module import tests...');
  
  try {
    console.log('Testing price service...');
    const prices = await priceService.getPrices(['bitcoin', 'ethereum']);
    console.log('Price service working! Sample prices:', prices);
    
    console.log('Testing arbitrage service...');
    await arbitrageService.scan();
    const opportunities = arbitrageService.getOpportunities();
    console.log(`Arbitrage service working! Found ${opportunities.length} opportunities.`);
    
    return {
      success: true,
      prices,
      opportunities: opportunities.length
    };
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
} 