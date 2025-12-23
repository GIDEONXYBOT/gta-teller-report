#!/usr/bin/env node

/**
 * Deploy frontend to Cloudflare Pages
 * Usage: node deploy.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting deployment to Cloudflare Pages...\n');

try {
  // Build
  console.log('📦 Building frontend...');
  execSync('npm run build', { cwd: path.join(__dirname), stdio: 'inherit' });

  // Deploy
  console.log('\n🌍 Deploying to Cloudflare Pages...');
  execSync('wrangler pages deploy dist --project-name=gideon-reports', { 
    cwd: path.join(__dirname), 
    stdio: 'inherit' 
  });

  console.log('\n✅ Deployment successful!');
  console.log('🔗 Visit: https://www.rmi.gideonbot.xyz');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
