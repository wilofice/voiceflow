#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# VoiceFlow Pro — Production Build Script
# Usage:
#   ./scripts/build-prod.sh                          # builds with localhost:3002 API (for local testing)
#   API_URL=https://api.yourserver.com ./scripts/build-prod.sh  # production API
# ─────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DESKTOP_DIR"

# ── Config ─────────────────────────────────────────────────────────
API_URL="${API_URL:-http://localhost:3002}"
NODE_ENV="production"
VERSION=$(node -p "require('./package.json').version")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       VoiceFlow Pro — Production Build       ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Version : $VERSION"
echo "║  API URL : $API_URL"
echo "║  Output  : dist-electron/"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Clean previous build artifacts ─────────────────────────
echo "→ Cleaning previous build..."
rm -rf dist dist-electron

# ── Step 2: Compile TypeScript (main + preload) ────────────────────
echo "→ Compiling main process + preload (TypeScript)..."
npx tsc -p tsconfig.main.json

# ── Step 3: Bundle renderer with webpack (production mode) ─────────
echo "→ Bundling renderer (webpack production)..."
NODE_ENV=production API_URL="$API_URL" npx webpack --config webpack.renderer.config.js

# ── Step 4: Package with electron-builder ─────────────────────────
echo "→ Packaging with electron-builder..."
npx electron-builder --mac dmg --publish=never

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo "✅ Build complete!"
echo "   Installer: dist-electron/VoiceFlow-Pro-${VERSION}-arm64.dmg"
echo "   (and x64 variant if built on Intel Mac)"
echo ""
echo "📋 To distribute to testers:"
echo "   1. Send them the .dmg file"
echo "   2. They drag VoiceFlow Pro to Applications"
echo "   3. First launch: right-click → Open (bypasses GateKeeper for unsigned builds)"
echo ""
