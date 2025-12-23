#!/bin/bash
# Cloudflare Pages build script

echo "🚀 Starting Cloudflare Pages build..."

# Install dependencies
npm ci

# Create production build
npm run build

echo "✅ Build complete! Output directory: dist"