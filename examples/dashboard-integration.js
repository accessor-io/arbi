import DashboardDebugger from '../src/debugger/debugger.js';

// Reliable debugger integration
document.addEventListener('DOMContentLoaded', function() {
  // Check if debugger is already initialized from the HTML file
  if (!window.dashDebugger) {
    console.log("Initializing dashboard debugger from integration script...");
    
    try {
      // First try the imported version
      if (typeof DashboardDebugger === 'function') {
        const debugger = new DashboardDebugger({
          theme: 'dark',
          position: 'bottom-right',
          maxLogEntries: 200,
          allowConsoleCapture: true
        });
        
        window.dashDebugger = debugger;
        console.log("Debugger successfully initialized from integration script");
        
        // Force it to be visible for testing
        debugger.show();
      } else {
        console.error("DashboardDebugger class not found in integration script");
      }
    } catch (error) {
      console.error("Error initializing debugger from integration script:", error);
    }
  } else {
    console.log("Debugger already initialized, using existing instance");
  }
  
  // Example usage of the debugger
  if (window.dashDebugger) {
    // Log messages
    window.dashDebugger.log('info', 'Dashboard initialized from integration script');
    
    // Track variables
    window.dashDebugger.setVariable('currentUser', { 
      id: 123, 
      name: 'John Doe', 
      role: 'Admin' 
    });
  }
});

// Example function
function updateDashboard(data) {
  try {
    // Your dashboard update logic here
    
    // Log progress if debugger exists
    if (window.dashDebugger) {
      window.dashDebugger.log('log', 'Dashboard updated with new data');
    }
  } catch (error) {
    // Log any errors
    if (window.dashDebugger) {
      window.dashDebugger.log('error', 'Error updating dashboard:', error);
    }
    console.error('Error updating dashboard:', error);
  }
} 