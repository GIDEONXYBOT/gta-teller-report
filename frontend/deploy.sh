#!/bin/bash
# Quick Production Deployment Script

echo "🚀 RMI Teller Report - Production Deployment Helper"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from the frontend directory!"
    echo "   cd frontend && bash deploy.sh"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci

echo "🔧 Building production bundle..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Push to GitHub: git add . && git commit -m 'Production ready' && git push"
    echo "2. Go to Cloudflare Pages and connect your repository"
    echo "3. Set build command: npm run build"
    echo "4. Set output directory: dist"
    echo "5. Add environment variables (see CLOUDFLARE-DEPLOYMENT.md)"
    echo ""
    echo "📁 Build output is ready in ./dist/"
    echo "🌐 Your app is ready for deployment!"
else
    echo "❌ Build failed. Check the errors above."
    exit 1
fi