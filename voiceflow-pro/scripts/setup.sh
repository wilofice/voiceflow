#!/bin/bash

echo "🚀 Setting up VoiceFlow Pro development environment..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npm run -w @voiceflow-pro/database db:generate

# Set up git hooks
echo "🪝 Setting up git hooks..."
npx husky install

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the required configuration"
echo "2. Run 'npm run db:push' to set up your database"
echo "3. Run 'npm run dev' to start the development servers"