# Batch Processing Migration Notes

## Migration Required

A new Prisma migration has been created to add batch processing functionality.

### Models Added:
- `BatchJob` - Represents a batch transcription job
- `BatchItem` - Represents individual items within a batch job

### Enums Added:
- `BatchJobStatus` - DRAFT, RUNNING, PAUSED, COMPLETED, ERROR
- `BatchItemStatus` - PENDING, PROCESSING, COMPLETED, ERROR, CANCELLED

### Relations Added:
- User → BatchJob (one-to-many)
- BatchJob → BatchItem (one-to-many)
- BatchItem → Transcript (one-to-one, optional)
- Transcript → BatchItem (one-to-one, optional)

## To Apply Migration:

When you're ready to apply this migration to your database, run:

```bash
cd packages/database
npx prisma migrate dev --name add_batch_job_models
```

Or in production:

```bash
cd packages/database
npx prisma migrate deploy
```

## Rollback:

If you need to rollback this migration, you can manually drop the tables:

```sql
DROP TABLE IF EXISTS "BatchItem" CASCADE;
DROP TABLE IF EXISTS "BatchJob" CASCADE;
DROP TYPE IF EXISTS "BatchJobStatus";
DROP TYPE IF EXISTS "BatchItemStatus";
```

Then remove the relation from the Transcript and User models in schema.prisma.
