// Simple script to verify file paths
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Checking critical file paths...');

const criticalFiles = [
  'src/ui/styles/main.css',
  'src/ui/public/styles.css',
  'src/ui/arbitrage-dashboard.js',
  'src/services/data/ArbitrageService.js',
  'styles.css',
  'server.js',
  'index.html',
  'arbitrage-dashboard.html'
];

let allFilesExist = true;

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  
  console.log(`${file}: ${exists ? '✓ exists' : '✗ missing'}`);
  
  if (!exists) {
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\nAll critical files exist! Your application should be able to load correctly.');
} else {
  console.log('\nSome critical files are missing. Please check the paths and create any missing files.');
} 