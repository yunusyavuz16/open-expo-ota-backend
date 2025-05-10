#!/bin/bash

# Script to set up the OpenExpoOTA database in Supabase

echo "OpenExpoOTA Database Setup"
echo "=========================="
echo ""
echo "This script will help you set up the database schema in Supabase."
echo ""

# Check if we're in the backend directory
if [ ! -f ".env" ]; then
  echo "Error: Must be run from the backend directory where .env file exists."
  exit 1
fi

# Load environment variables
source .env

# Check for required environment variables and prompt if missing
if [ -z "$SUPABASE_URL" ]; then
  echo "SUPABASE_URL is not set in your .env file."
  read -p "Enter your Supabase URL (e.g., https://your-project-id.supabase.co): " supabase_url

  # Update the .env file with the new URL
  if [ -n "$supabase_url" ]; then
    if grep -q "SUPABASE_URL=" .env; then
      sed -i '' "s|SUPABASE_URL=.*|SUPABASE_URL=$supabase_url|" .env
    else
      echo "SUPABASE_URL=$supabase_url" >> .env
    fi
    SUPABASE_URL=$supabase_url
    echo "Updated SUPABASE_URL in .env file."
  else
    echo "Error: SUPABASE_URL is required."
    exit 1
  fi
fi

if [ -z "$SUPABASE_KEY" ]; then
  echo "SUPABASE_KEY is not set in your .env file."
  read -p "Enter your Supabase service role key: " supabase_key

  # Update the .env file with the new key
  if [ -n "$supabase_key" ]; then
    if grep -q "SUPABASE_KEY=" .env; then
      sed -i '' "s|SUPABASE_KEY=.*|SUPABASE_KEY=$supabase_key|" .env
    else
      echo "SUPABASE_KEY=$supabase_key" >> .env
    fi
    SUPABASE_KEY=$supabase_key
    echo "Updated SUPABASE_KEY in .env file."
  else
    echo "Error: SUPABASE_KEY is required."
    exit 1
  fi
fi

echo "Using Supabase project at: $SUPABASE_URL"
echo ""
echo "IMPORTANT: You need to use the service_role key, not the anon key."
echo "If you're using an anonymous key, it won't have enough permissions."
echo ""
echo "Please go to your Supabase project settings > API and get the service_role key."
echo ""

read -p "Would you like to update your service_role key? (y/n) " update_key

if [ "$update_key" = "y" ] || [ "$update_key" = "Y" ]; then
  read -p "Enter your service_role key: " service_key

  # Update the .env file with the new key
  if [ -n "$service_key" ]; then
    sed -i '' "s|SUPABASE_KEY=.*|SUPABASE_KEY=$service_key|" .env
    SUPABASE_KEY=$service_key
    echo "Updated SUPABASE_KEY in .env file."
  else
    echo "No key provided. Keeping existing key."
  fi
fi

echo ""
echo "Step 1: Creating run_sql function in Supabase"
echo "--------------------------------------------"
echo "Copy the following SQL and run it in the Supabase SQL Editor:"
echo ""
cat migrations/setup-db.sql
echo ""
echo "After running the SQL above in the Supabase SQL Editor, press Enter to continue..."
read

echo ""
echo "Step 2: Running migrations"
echo "-------------------------"
echo "Running migration script..."

# Change to migrations directory and run the script
cd migrations
node run-migrations.js

# Check if migrations succeeded
if [ $? -eq 0 ]; then
  echo ""
  echo "Database setup complete!"
  echo ""
  echo "You can now run the backend server with: npm start"
else
  echo ""
  echo "Error: Migration failed. Please check the error message above."
fi