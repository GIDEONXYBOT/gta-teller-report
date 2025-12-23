#!/bin/bash

echo "========================================"
echo "RMI Teller Report - Production Build"
echo "========================================"
echo

echo "Building frontend..."
cd frontend
if [ -d "dist" ]; then
    rm -rf dist
fi
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi
echo "✅ Frontend built successfully"
cd ..

echo
echo "Starting production server..."
echo "Backend will serve both API and frontend"
echo "Access at: http://localhost:5000"
echo
npm start