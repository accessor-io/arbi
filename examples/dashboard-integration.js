import DashboardDebugger from '../src/debugger/debugger.js';

// Initialize the debugger when your dashboard loads
document.addEventListener('DOMContentLoaded', function() {
  // Create the debugger instance
  const debugger = new DashboardDebugger({
    theme: 'dark',               // 'dark' or 'light'
    position: 'bottom-right',    // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
    maxLogEntries: 200,          // Maximum number of log entries to keep
    allowConsoleCapture: true    // Capture console.log, error, warn, info
  });
  
  // Store it globally for access across your dashboard
  window.dashDebugger = debugger;
  
  // Example usage
  // Log messages manually
  debugger.log('info', 'Dashboard initialized');
  
  // Track variables
  debugger.setVariable('currentUser', { 
    id: 123, 
    name: 'John Doe', 
    role: 'Admin' 
  });
  
  // Example of how to use it with API calls
  fetch('/api/dashboard/data')
    .then(response => response.json())
    .then(data => {
      // Log the API response
      debugger.log('info', 'API data received:', data);
      
      // Track important data
      debugger.setVariable('dashboardData', data);
      
      // Continue with your dashboard logic
      updateDashboard(data);
    })
    .catch(error => {
      // Log errors
      debugger.log('error', 'API request failed:', error);
    });
});

// Example function that uses the debugger
function updateDashboard(data) {
  try {
    // Your dashboard update logic here
    
    // Log progress
    window.dashDebugger.log('log', 'Dashboard updated with new data');
  } catch (error) {
    // Log any errors
    window.dashDebugger.log('error', 'Error updating dashboard:', error);
  }
} 