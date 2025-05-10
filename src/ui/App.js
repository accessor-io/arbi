import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import TokenManager from '../services/utils/TokenManager.js';
import { logger } from '../utils/logger.js';

function App() {
  const [provider, setProvider] = useState(null);
  const [tokenManager, setTokenManager] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [config, setConfig] = useState({
    scanInterval: 30000,
    maxRetries: 3,
    delay: 1000
  });

  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        const tm = new TokenManager(provider);
        await tm.initialize();
        setTokenManager(tm);
      }
    };
    initProvider();
  }, []);

  useEffect(() => {
    const fetchPairs = async () => {
      if (tokenManager) {
        await tokenManager.fetchPairs();
        setPairs(tokenManager.pairs);
      }
    };
    fetchPairs();
  }, [tokenManager]);

  useEffect(() => {
    const fetchTokens = async () => {
      if (tokenManager) {
        const allTokens = await tokenManager.getTopTokens();
        setTokens(allTokens);
      }
    };
    fetchTokens();
  }, [tokenManager]);

  const handleConfigChange = (key, value) => {
    setConfig(prevConfig => ({ ...prevConfig, [key]: value }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Crypto Arbitrage</h1>
      </header>
      <main>
        <section>
          <h2>Configuration Settings</h2>
          <div>
            <label>
              Scan Interval (ms):
              <input
                type="number"
                value={config.scanInterval}
                onChange={(e) => handleConfigChange('scanInterval', parseInt(e.target.value))}
              />
            </label>
          </div>
          <div>
            <label>
              Max Retries:
              <input
                type="number"
                value={config.maxRetries}
                onChange={(e) => handleConfigChange('maxRetries', parseInt(e.target.value))}
              />
            </label>
          </div>
          <div>
            <label>
              Delay (ms):
              <input
                type="number"
                value={config.delay}
                onChange={(e) => handleConfigChange('delay', parseInt(e.target.value))}
              />
            </label>
          </div>
        </section>
        <section>
          <h2>Fetched Pairs</h2>
          <ul>
            {pairs.map((pair, index) => (
              <li key={index}>
                {pair.dex}: {pair.token0} - {pair.token1}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>All Tokens</h2>
          <ul>
            {tokens.map((token, index) => (
              <li key={index}>
                {token.symbol} ({token.address})
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App; 