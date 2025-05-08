// Convert to ES module format
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Properly set content types for files
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (ext === '.js') {
    res.type('application/javascript');
  } else if (ext === '.css') {
    res.type('text/css');
  }
  next();
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Handle SPA routing
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 