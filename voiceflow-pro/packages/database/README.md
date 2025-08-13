# Database Package - VoiceFlow Pro

This package contains the database schema, types, and migration scripts for VoiceFlow Pro with Whisper integration support.

## Overview

The database supports both OpenAI API and local Whisper.cpp transcription methods, with comprehensive tracking of processing methods, performance statistics, and user preferences.

## Schema Overview

### Core Tables
- **User**: User accounts and subscription tiers
- **Transcript**: Transcription records with method tracking
- **TranscriptSegment**: Individual transcript segments with timing
- **TranscriptComment**: Comments on transcripts
- **TranscriptShare**: Transcript sharing permissions
- **UserPreferences**: User-specific transcription preferences

### New Whisper Integration Features
- **Transcription Method Tracking**: OpenAI, Local Whisper, or Docker Whisper
- **Processing Location**: Cloud, Local Machine, or Container
- **Performance Statistics**: Processing time, cost, quality scores
- **User Preferences**: Default methods, privacy settings, model preferences

## Database Schema

### Transcript Table (Enhanced)
```sql
ALTER TABLE "Transcript" ADD COLUMN:
- transcriptionMethod: ENUM('OPENAI', 'WHISPER_LOCAL', 'WHISPER_DOCKER')
- whisperModel: TEXT (tiny, base, small, medium, etc.)
- processingLocation: ENUM('CLOUD', 'LOCAL', 'CONTAINER') 
- processingStats: JSONB (performance metrics, cost, quality)
```

### UserPreferences Table (New)
```sql
CREATE TABLE "UserPreferences":
- defaultTranscriptionMethod: User's preferred method
- defaultWhisperModel: Preferred Whisper model
- autoDownloadModels: Auto-download Whisper models
- privacyMode: Prefer local processing
- preferredProcessingLocation: User's location preference
- maxFileSize: Max file size for local processing (MB)
```

## Migrations

### Running Migrations

1. **Apply Whisper Integration**:
   ```bash
   cd packages/database
   ./scripts/migrate.sh
   ```

2. **Rollback Changes**:
   ```bash
   cd packages/database  
   ./scripts/rollback.sh
   ```

### Migration Files

- `001_add_server_whisper_support.sql`: Adds Whisper integration schema
- `001_add_server_whisper_support_rollback.sql`: Removes Whisper integration
- `002_update_rls_policies_whisper.sql`: Updates security policies

### Prerequisites

- PostgreSQL database with Supabase
- `DATABASE_URL` environment variable set
- `psql` command-line tool OR Docker with `POSTGRES_CONTAINER` variable

## Types

The `database.types.ts` file provides TypeScript interfaces for:

- **TranscriptionMethod**: 'OPENAI' | 'WHISPER_LOCAL' | 'WHISPER_DOCKER'
- **ProcessingLocation**: 'CLOUD' | 'LOCAL' | 'CONTAINER'  
- **ProcessingStats**: Performance metrics interface
- **Database**: Complete database schema types

## Row Level Security (RLS)

All tables have appropriate RLS policies:

- Users can only access their own data
- Shared transcripts respect access levels
- UserPreferences are private to each user
- Storage policies secure file access

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:port/db
POSTGRES_CONTAINER=container_name  # If using Docker
```

## Development

### After Schema Changes

1. Update Prisma schema in `schema.prisma`
2. Run migrations with `./scripts/migrate.sh`
3. Generate Prisma client: `npx prisma generate`
4. Update application code as needed

### Prisma Commands

```bash
# Generate client after schema changes
npx prisma generate

# Pull schema from database  
npx prisma db pull

# Reset database (development only)
npx prisma migrate reset

# View database
npx prisma studio
```

## Performance Considerations

### Indexes Created
- `transcriptionMethod` for method-based queries
- `processingLocation` for location-based analytics  
- `(userId, transcriptionMethod)` for user method preferences
- `userId` on UserPreferences for fast user lookups

### Query Optimization
- Use indexes for filtering by transcription method
- Batch queries for performance statistics
- Consider partitioning for large transcript tables

## Security

### Data Privacy
- ProcessingStats stored as JSONB for flexibility
- No sensitive data in processing statistics
- User preferences control privacy settings
- RLS policies enforce data isolation

### Best Practices
- Always validate transcription methods
- Sanitize processing statistics before storage
- Use prepared statements for queries
- Monitor for unusual access patterns

## Monitoring

### Key Metrics to Track
- Transcription method usage distribution
- Processing time averages by method
- User preference adoption rates
- Error rates by processing location
- Cost analysis by method

### Sample Queries

```sql
-- Method usage statistics
SELECT "transcriptionMethod", COUNT(*) 
FROM "Transcript" 
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY "transcriptionMethod";

-- Average processing times
SELECT 
  "transcriptionMethod",
  AVG(CAST("processingStats"->>'processingTime' AS INTEGER)) as avg_time
FROM "Transcript" 
WHERE "processingStats" IS NOT NULL
GROUP BY "transcriptionMethod";

-- User preference distribution  
SELECT "defaultTranscriptionMethod", COUNT(*)
FROM "UserPreferences"
GROUP BY "defaultTranscriptionMethod";
```

## Troubleshooting

### Common Issues

1. **Migration Fails**:
   - Check DATABASE_URL is correct
   - Ensure database is accessible
   - Verify user has CREATE/ALTER permissions

2. **RLS Policies Block Access**:
   - Check auth.uid() is properly set
   - Verify user authentication
   - Review policy conditions

3. **Type Mismatches**:
   - Run `npx prisma generate` after schema changes
   - Check enum values match between schema and code
   - Verify JSON structure for processingStats

### Support

For issues with database schema or migrations:
1. Check migration logs for specific errors
2. Verify database connectivity 
3. Review RLS policies for access issues
4. Consult Prisma/Supabase documentation