// In-Dashboard Debugger
class DashboardDebugger {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'dashboard-debugger',
      position: options.position || 'bottom-right',
      theme: options.theme || 'dark',
      maxLogEntries: options.maxLogEntries || 100,
      allowConsoleCapture: options.allowConsoleCapture !== false,
    };
    
    this.logs = [];
    this.variables = new Map();
    this.isVisible = false;
    this.isInitialized = false;
    
    this.init();
  }
  
  init() {
    if (this.isInitialized) return;
    
    this.createDebuggerUI();
    
    if (this.options.allowConsoleCapture) {
      this.captureConsoleOutput();
    }
    
    this.isInitialized = true;
  }
  
  createDebuggerUI() {
    // Create container if it doesn't exist
    let container = document.getElementById(this.options.containerId);
    
    if (!container) {
      container = document.createElement('div');
      container.id = this.options.containerId;
      document.body.appendChild(container);
    }
    
    // Set container styles
    container.className = `dashboard-debugger ${this.options.theme} ${this.options.position}`;
    container.style.display = 'none';
    
    // Create debugger components
    container.innerHTML = `
      <div class="debugger-header">
        <h3>Dashboard Debugger</h3>
        <div class="debugger-controls">
          <button id="debugger-clear-btn">Clear</button>
          <button id="debugger-close-btn">Close</button>
        </div>
      </div>
      <div class="debugger-tabs">
        <button class="tab-button active" data-tab="logs">Logs</button>
        <button class="tab-button" data-tab="variables">Variables</button>
        <button class="tab-button" data-tab="network">Network</button>
      </div>
      <div class="debugger-content">
        <div id="logs-panel" class="panel active">
          <div class="log-entries"></div>
        </div>
        <div id="variables-panel" class="panel">
          <div class="variables-list"></div>
        </div>
        <div id="network-panel" class="panel">
          <div class="network-requests"></div>
        </div>
      </div>
    `;
    
    // Add event listeners
    document.getElementById('debugger-close-btn').addEventListener('click', () => this.hide());
    document.getElementById('debugger-clear-btn').addEventListener('click', () => this.clear());
    
    // Set up tab switching
    const tabs = container.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active class from all tabs and panels
        tabs.forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked tab
        e.target.classList.add('active');
        
        // Show corresponding panel
        const panelId = `${e.target.dataset.tab}-panel`;
        document.getElementById(panelId).classList.add('active');
      });
    });
    
    // Create toggle button
    this.createToggleButton();
  }
  
  createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'debugger-toggle';
    toggleBtn.innerHTML = 'Debug Console';
    toggleBtn.className = `debugger-toggle ${this.options.theme}`;
    
    toggleBtn.style.padding = '10px 20px';
    toggleBtn.style.fontSize = '16px';
    toggleBtn.style.backgroundColor = '#ff5500';
    
    toggleBtn.addEventListener('click', () => {
      this.toggle();
    });
    
    document.body.appendChild(toggleBtn);
    console.log("Debug toggle button created and appended to body");
  }
  
  captureConsoleOutput() {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    
    // Override console methods
    console.log = (...args) => {
      this.log('log', ...args);
      originalConsole.log(...args);
    };
    
    console.error = (...args) => {
      this.log('error', ...args);
      originalConsole.error(...args);
    };
    
    console.warn = (...args) => {
      this.log('warn', ...args);
      originalConsole.warn(...args);
    };
    
    console.info = (...args) => {
      this.log('info', ...args);
      originalConsole.info(...args);
    };
  }
  
  log(level, ...args) {
    const time = new Date().toISOString();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join(' ');
    
    const logEntry = {
      level,
      message: formattedArgs,
      time
    };
    
    this.logs.push(logEntry);
    
    // Trim logs if they exceed max entries
    if (this.logs.length > this.options.maxLogEntries) {
      this.logs = this.logs.slice(-this.options.maxLogEntries);
    }
    
    this.updateLogsPanel();
  }
  
  updateLogsPanel() {
    if (!this.isInitialized) return;
    
    const logEntriesEl = document.querySelector(`#${this.options.containerId} .log-entries`);
    if (!logEntriesEl) return;
    
    logEntriesEl.innerHTML = this.logs.map(entry => {
      return `
        <div class="log-entry ${entry.level}">
          <span class="log-time">${entry.time.split('T')[1].split('.')[0]}</span>
          <span class="log-level">${entry.level}</span>
          <span class="log-message">${entry.message}</span>
        </div>
      `;
    }).join('');
    
    // Auto-scroll to bottom
    logEntriesEl.scrollTop = logEntriesEl.scrollHeight;
  }
  
  setVariable(name, value) {
    this.variables.set(name, value);
    this.updateVariablesPanel();
  }
  
  deleteVariable(name) {
    this.variables.delete(name);
    this.updateVariablesPanel();
  }
  
  updateVariablesPanel() {
    if (!this.isInitialized) return;
    
    const variablesListEl = document.querySelector(`#${this.options.containerId} .variables-list`);
    if (!variablesListEl) return;c
    variablesListEl.innerHTML = '';
    this.variables.forEach((value, name) => {
      const variableEl = document.createElement('div');
      variableEl.className = 'variable-item';
      variableEl.innerHTML = `
        <div class="variable-name">${name}</div>
        <div class="variable-value">${typeof value === 'object' ? JSON.stringify(value) : value}</div>
      `;
      variablesListEl.appendChild(variableEl);
    });
  }
  
  show() {
    const container = document.getElementById(this.options.containerId);
    if (container) {
      container.style.display = 'flex';
      this.isVisible = true;
    }
  }
  
  hide() {
    const container = document.getElementById(this.options.containerId);
    if (container) {
      container.style.display = 'none';
      this.isVisible = false;
    }
  }
  
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  clear() {
    this.logs = [];
    this.updateLogsPanel();
  }
}

// Export the debugger
window.DashboardDebugger = DashboardDebugger;
export default DashboardDebugger; 