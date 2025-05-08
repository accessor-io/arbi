#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

async function build() {
  try {
    logger.info('Starting build process...');

    // Clean previous build
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // Copy public files
    logger.info('Copying public files...');
    fs.cpSync(publicDir, path.join(distDir, 'public'), { recursive: true });

    // Copy source files
    logger.info('Copying source files...');
    fs.cpSync(path.join(rootDir, 'src'), path.join(distDir, 'src'), { recursive: true });

    // Copy configuration files
    logger.info('Copying configuration files...');
    const configFiles = [
      'package.json',
      'package-lock.json',
      '.env.example',
      'Dockerfile',
      'docker-compose.yml'
    ];

    configFiles.forEach(file => {
      if (fs.existsSync(path.join(rootDir, file))) {
        fs.copyFileSync(
          path.join(rootDir, file),
          path.join(distDir, file)
        );
      }
    });

    // Install production dependencies
    logger.info('Installing production dependencies...');
    execSync('npm ci --production', { cwd: distDir, stdio: 'inherit' });

    logger.info('Build completed successfully!');
    logger.info(`Distribution directory: ${distDir}`);
  } catch (error) {
    logger.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 