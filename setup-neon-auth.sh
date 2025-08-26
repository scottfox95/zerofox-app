#!/bin/bash

# Neon Auth Setup Script
# This script will help you set up Neon Auth integration using the Neon API

echo "🚀 Setting up Neon Auth Integration"
echo "=================================="

# Check if required environment variables are set
if [ -z "$NEON_API_KEY" ]; then
    echo "❌ NEON_API_KEY environment variable is required"
    echo "   Get your API key from: https://console.neon.tech/app/settings/api-keys"
    echo "   Then run: export NEON_API_KEY=your_api_key"
    exit 1
fi

if [ -z "$NEON_PROJECT_ID" ]; then
    echo "❌ NEON_PROJECT_ID environment variable is required"
    echo "   Find your project ID in the Neon Console Settings page"
    echo "   Then run: export NEON_PROJECT_ID=your_project_id"
    exit 1
fi

# Optional parameters with defaults
BRANCH_ID=${NEON_BRANCH_ID:-""}
DATABASE_NAME=${NEON_DATABASE_NAME:-"neondb"}
ROLE_NAME=${NEON_ROLE_NAME:-"neondb_owner"}

# Get branch ID if not provided
if [ -z "$BRANCH_ID" ]; then
    echo "📋 Getting branch information..."
    BRANCHES_RESPONSE=$(curl -s --request GET \
        --url "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
        --header "authorization: Bearer $NEON_API_KEY")
    
    BRANCH_ID=$(echo "$BRANCHES_RESPONSE" | jq -r '.branches[] | select(.default == true) | .id')
    
    if [ -z "$BRANCH_ID" ] || [ "$BRANCH_ID" = "null" ]; then
        echo "❌ Could not find default branch ID"
        echo "   Please set NEON_BRANCH_ID manually"
        exit 1
    fi
    
    echo "✅ Found default branch: $BRANCH_ID"
fi

echo "📝 Configuration:"
echo "   Project ID: $NEON_PROJECT_ID"
echo "   Branch ID: $BRANCH_ID"
echo "   Database: $DATABASE_NAME"
echo "   Role: $ROLE_NAME"

# Create the integration
echo ""
echo "🔧 Creating Neon Auth integration..."

INTEGRATION_RESPONSE=$(curl -s --request POST \
    --url 'https://console.neon.tech/api/v2/projects/auth/create' \
    --header "authorization: Bearer $NEON_API_KEY" \
    --header 'content-type: application/json' \
    --data '{
        "auth_provider": "stack",
        "project_id": "'"$NEON_PROJECT_ID"'",
        "branch_id": "'"$BRANCH_ID"'",
        "database_name": "'"$DATABASE_NAME"'",
        "role_name": "'"$ROLE_NAME"'"
    }')

# Check if the request was successful
if echo "$INTEGRATION_RESPONSE" | jq -e '.auth_provider' > /dev/null 2>&1; then
    echo "✅ Integration created successfully!"
    
    # Extract the keys
    AUTH_PROVIDER_PROJECT_ID=$(echo "$INTEGRATION_RESPONSE" | jq -r '.auth_provider_project_id')
    PUB_CLIENT_KEY=$(echo "$INTEGRATION_RESPONSE" | jq -r '.pub_client_key')
    SECRET_SERVER_KEY=$(echo "$INTEGRATION_RESPONSE" | jq -r '.secret_server_key')
    JWKS_URL=$(echo "$INTEGRATION_RESPONSE" | jq -r '.jwks_url')
    
    echo ""
    echo "🔑 Your Neon Auth keys:"
    echo "========================="
    echo "NEXT_PUBLIC_STACK_PROJECT_ID=$AUTH_PROVIDER_PROJECT_ID"
    echo "NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=$PUB_CLIENT_KEY"
    echo "STACK_SECRET_SERVER_KEY=$SECRET_SERVER_KEY"
    echo ""
    
    # Create .env.local file
    echo "📁 Creating .env.local file..."
    cat > .env.local << EOF
# Database (NeonDB)
NEON_DATABASE_URL=your-neon-database-connection-string

# Neon Auth (Stack Auth)
NEXT_PUBLIC_STACK_PROJECT_ID=$AUTH_PROVIDER_PROJECT_ID
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=$PUB_CLIENT_KEY
STACK_SECRET_SERVER_KEY=$SECRET_SERVER_KEY

# AI Models
ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key
GOOGLE_AI_API_KEY=your-gemini-api-key

# App Settings
DEFAULT_AI_MODEL=claude
ADMIN_EMAIL=admin@yourcompany.com
EOF
    
    echo "✅ Created .env.local file with your Neon Auth keys"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Add your NEON_DATABASE_URL to .env.local"
    echo "2. Add your AI API keys to .env.local"
    echo "3. Restart your development server: npm run dev"
    echo "4. Test the authentication at /login and /register"
    
else
    echo "❌ Failed to create integration"
    echo "Response: $INTEGRATION_RESPONSE"
    exit 1
fi