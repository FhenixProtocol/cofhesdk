#!/bin/bash

echo "🚀 Starting CoFHE SDK React Components Example"
echo "============================================="
echo ""
echo "📦 Building React package..."
cd packages/react && pnpm build && cd ../..

echo ""
echo "🌐 Starting development server..."
echo "📍 Example will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd example && pnpm dev
