import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTML files to update
const htmlFiles = [
  'index.html',
  'docs.html',
  'debugger-test.html',
  'arbitrage-dashboard.html',
  'examples/dashboard-example.html'
];

// Update CSS paths
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix CSS path references
    content = content.replace(/href="src\/ui\/public\/styles\.css"/g, 'href="/src/ui/public/styles.css"');
    content = content.replace(/href="\.\.\/src\/ui\/public\/styles\.css"/g, 'href="/src/ui/public/styles.css"');
    
    // Fix script paths
    content = content.replace(/src="src\//g, 'src="/src/');
    content = content.replace(/src="\.\.\/src\//g, 'src="/src/');
    
    // Add type="module" to script tags if not present
    content = content.replace(/<script src="\/src\/([^"]+)"([^>]*)>/g, (match, scriptPath, attrs) => {
      if (!attrs.includes('type="module"')) {
        return `<script type="module" src="/src/${scriptPath}"${attrs}>`;
      }
      return match;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated paths in ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});

console.log('Path updates complete'); 