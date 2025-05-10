#!/bin/bash

# OpenExpoOTA Backend Setup Script
# This script helps set up the backend environment and configuration

echo "👋 Welcome to OpenExpoOTA Backend Setup"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14 or newer."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please upgrade to v14 or newer."
    exit 1
fi

echo "✅ Node.js $(node -v) is installed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit the .env file with your configuration"
else
    echo ""
    echo "ℹ️  .env file already exists, skipping creation"
fi

# Prompt for Supabase configuration if .env exists
if [ -f .env ]; then
    echo ""
    echo "🔑 Would you like to configure Supabase now? (y/n)"
    read -r configure_supabase

    if [[ $configure_supabase == "y" || $configure_supabase == "Y" ]]; then
        echo ""
        echo "Enter your Supabase URL (e.g., https://your-project-id.supabase.co):"
        read -r supabase_url

        echo "Enter your Supabase service role key:"
        read -r supabase_key

        if [[ -n "$supabase_url" && -n "$supabase_key" ]]; then
            # Update .env file
            sed -i.bak "s|SUPABASE_URL=.*|SUPABASE_URL=$supabase_url|g" .env
            sed -i.bak "s|SUPABASE_KEY=.*|SUPABASE_KEY=$supabase_key|g" .env
            rm -f .env.bak

            echo "✅ Supabase configuration updated"

            # Test Supabase connection
            echo ""
            echo "🔄 Testing Supabase connection..."
            npx ts-node src/scripts/test-supabase.ts
        else
            echo "⚠️  Supabase configuration skipped due to empty values"
        fi
    else
        echo "ℹ️  Skipping Supabase configuration"
    fi
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration if you haven't already"
echo "2. Run migrations to set up the database schema: npm run migrate"
echo "3. Start the development server: npm run dev"
echo ""
echo "Happy coding! 🚀"