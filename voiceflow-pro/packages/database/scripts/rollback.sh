#!/bin/bash

# Database Rollback Script for VoiceFlow Pro
# Rolls back database schema changes for Whisper integration

set -e

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

echo "⚠️  WARNING: This will REMOVE Whisper integration from the database"
echo "   This action will:"
echo "   - Remove the UserPreferences table"
echo "   - Remove transcription method columns from Transcript table"
echo "   - Remove all Whisper-related data"
echo
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 0
fi

echo "🔄 Starting database rollback..."

# Function to run SQL file
run_sql_file() {
    local file_path="$1"
    local description="$2"
    
    echo "📄 Running: $description"
    echo "   File: $(basename "$file_path")"
    
    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -f "$file_path"
    elif command -v docker >/dev/null 2>&1 && [ -n "$POSTGRES_CONTAINER" ]; then
        docker exec -i "$POSTGRES_CONTAINER" psql "$DATABASE_URL" < "$file_path"
    else
        echo "❌ Neither psql nor docker with POSTGRES_CONTAINER is available"
        exit 1
    fi
    
    echo "✅ Completed: $description"
    echo
}

# Apply rollback
run_sql_file "$MIGRATIONS_DIR/001_add_server_whisper_support_rollback.sql" \
    "Remove server-side Whisper processing support"

echo "✅ Rollback completed successfully!"
echo
echo "📊 Summary of changes:"
echo "  ✓ Removed transcriptionMethod column from Transcript table"
echo "  ✓ Removed whisperModel column from Transcript table"  
echo "  ✓ Removed processingLocation column from Transcript table"
echo "  ✓ Removed processingStats column from Transcript table"
echo "  ✓ Dropped UserPreferences table"
echo "  ✓ Removed related indexes and enum types"
echo
echo "🔄 Next steps:"
echo "  1. Update your Prisma schema to remove Whisper fields"
echo "  2. Update your Prisma client: npx prisma generate"  
echo "  3. Update application code to remove Whisper references"