#!/bin/bash

# Build script for TensorFlow.js bundler
# Builds the bundle and provides instructions for copying to background.js

set -e  # Exit on error

echo "========================================="
echo "DAMS.AI TensorFlow.js Bundler"
echo "========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the bundle
echo "🔨 Building TensorFlow.js bundle..."
echo ""

# Try normal build first
if npm run build 2>/dev/null; then
    echo "✅ Build successful!"
else
    echo "⚠️  Normal build failed, trying with legacy OpenSSL provider..."
    npm run build:legacy
    echo "✅ Build successful with legacy provider!"
fi

echo ""
echo "========================================="
echo "Build Complete!"
echo "========================================="
echo ""
echo "📁 Output files:"
ls -lh dist/tfjs-bundle.js* | awk '{print "  ", $9, "-", $5}'
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Review the generated bundle:"
echo "   less dist/tfjs-bundle.js"
echo ""
echo "2. Copy bundle to Chrome extension background.js:"
echo "   cp dist/tfjs-bundle.js ../chromeExtension/background.js"
echo ""
echo "   ⚠️  WARNING: This will OVERWRITE background.js!"
echo "   Make sure to backup any custom code in background.js first."
echo ""
echo "3. Or manually prepend to existing background.js:"
echo "   cat dist/tfjs-bundle.js ../chromeExtension/background.js.backup > ../chromeExtension/background.js"
echo ""
echo "4. Test in Chrome extension (chrome://extensions/)"
echo ""
echo "========================================="
