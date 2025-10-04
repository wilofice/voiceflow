#!/bin/bash

# Database Migration Script for VoiceFlow Pro
# Applies database schema changes for Whisper integration

set -e

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

echo "🚀 Starting database migration for Whisper integration..."

# Function to run SQL file
run_sql_file() {
    local file_path="$1"
    local description="$2"
    
    echo "📄 Running: $description"
    echo "   File: $(basename "$file_path")"
    
    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -f "$file_path"
    elif [ -x "/Library/PostgreSQL/17/bin/psql" ]; then
        /Library/PostgreSQL/17/bin/psql "$DATABASE_URL" -f "$file_path"
    elif command -v docker >/dev/null 2>&1 && [ -n "$POSTGRES_CONTAINER" ]; then
        docker exec -i "$POSTGRES_CONTAINER" psql "$DATABASE_URL" < "$file_path"
    else
        echo "❌ Neither psql, /Library/PostgreSQL/17/bin/psql, nor docker with POSTGRES_CONTAINER is available"
        exit 1
    fi
    
    echo "✅ Completed: $description"
    echo
}

# Apply migrations in order
echo "📋 Applying migrations..."

# 1. Add server Whisper support
run_sql_file "$MIGRATIONS_DIR/001_add_server_whisper_support.sql" \
    "Add server-side Whisper processing support"

# 2. Update RLS policies
run_sql_file "$MIGRATIONS_DIR/002_update_rls_policies_whisper.sql" \
    "Update RLS policies for Whisper integration"

echo "🎉 All migrations completed successfully!"
echo
echo "📊 Summary of changes:"
echo "  ✓ Added transcriptionMethod column to Transcript table"
echo "  ✓ Added whisperModel column to Transcript table"  
echo "  ✓ Added processingLocation column to Transcript table"
echo "  ✓ Added processingStats column to Transcript table"
echo "  ✓ Created UserPreferences table"
echo "  ✓ Added appropriate indexes for performance"
echo "  ✓ Updated RLS policies for security"
echo
echo "🔄 Next steps:"
echo "  1. Update your Prisma client: npx prisma generate"
echo "  2. Verify schema sync: npx prisma db pull"
echo "  3. Update application code to use new columns"