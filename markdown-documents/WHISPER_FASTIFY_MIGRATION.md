# Whisper API Routes - Express to Fastify Migration

## Overview
This document details the migration of Whisper API routes from Express.js to Fastify framework to ensure compatibility with the main server architecture.

## Problem Identified
- **Framework Mismatch**: Server uses Fastify, but Whisper routes were using Express Router
- **Route Registration Missing**: Whisper routes were not registered in the main server
- **Middleware Incompatibility**: Express multer vs Fastify multipart handling
- **Authentication Issues**: Different authentication patterns between frameworks

## Changes Made

### 1. Route File Conversion (`/apps/api/src/routes/whisper.ts`)

#### Before (Express):
```typescript
import { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ ... });

router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  // Express route handler
});
```

#### After (Fastify):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

export async function whisperRoutes(fastify: FastifyInstance) {
  fastify.post('/transcribe', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const file = await request.file();
    // Fastify route handler
  });
}
```

### 2. Key Migration Changes

#### File Upload Handling
- **Removed**: `multer` middleware
- **Added**: Fastify's built-in `request.file()` method
- **File Processing**: Manual file saving with `fs.writeFile()`

#### Request/Response Objects
- **Before**: Express `req`, `res`
- **After**: Fastify `request`, `reply`

#### Route Registration Pattern
- **Before**: Express Router with middleware chain
- **After**: Fastify route registration with options object

#### Authentication
- **Before**: Would need custom Express middleware
- **After**: Uses existing Fastify `authenticate` preHandler

#### Schema Validation
- **Added**: Zod schemas for request validation
- **Integrated**: Type-safe request parsing

### 3. Server Registration (`/apps/api/src/server.ts`)

Added import and registration:
```typescript
import { whisperRoutes } from './routes/whisper';

// In start() function
await server.register(whisperRoutes, { prefix: '/api/whisper' });
```

Updated file upload limits:
```typescript
await server.register(multipart, {
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000'), // 500MB default
    files: 1, // Max number of files per request
  },
});
```

### 4. API Endpoints

All endpoints now follow Fastify patterns and are accessible at:

- `POST /api/whisper/transcribe` - Hybrid transcription with intelligent routing
- `POST /api/whisper/transcribe/local` - Local Whisper processing
- `POST /api/whisper/transcribe/docker` - Docker Whisper processing
- `GET /api/whisper/health` - Service health status
- `GET /api/whisper/models` - Available models
- `GET /api/whisper/performance` - Performance metrics
- `GET /api/whisper/jobs/:jobId` - Job status
- `GET /api/whisper/jobs` - All active jobs
- `DELETE /api/whisper/jobs/:jobId` - Cancel job
- `POST /api/whisper/docker/start` - Start Docker container
- `POST /api/whisper/docker/stop` - Stop Docker container
- `GET /api/whisper/monitoring/overall` - Overall monitoring status
- `GET /api/whisper/monitoring/alerts` - Monitoring alerts

### 5. Testing

Created test script at `/apps/api/scripts/test-whisper-api.sh` to verify endpoints.

## Benefits of Migration

1. **Framework Consistency**: All routes now use the same Fastify framework
2. **Performance**: Fastify is faster than Express
3. **Type Safety**: Better TypeScript integration with Fastify
4. **Schema Validation**: Built-in schema validation support
5. **Authentication**: Reuses existing auth middleware
6. **File Handling**: Consistent file upload handling across all routes

## Migration Checklist

- [x] Convert route file from Express to Fastify
- [x] Update imports and types
- [x] Convert route handlers to Fastify pattern
- [x] Replace multer with Fastify multipart
- [x] Add authentication preHandlers
- [x] Implement schema validation
- [x] Register routes in server.ts
- [x] Update file size limits
- [x] Add logging for route registration
- [x] Create test script

## Next Steps

1. **Test Integration**: Run the server and test all Whisper endpoints
2. **Update Frontend**: Ensure frontend API calls match new endpoint structure
3. **Environment Variables**: Add Whisper-specific environment variables
4. **Documentation**: Update API documentation with Whisper endpoints
5. **Error Handling**: Verify error responses match Fastify patterns

## Environment Variables

Add to `.env`:
```env
# Whisper Configuration
ENABLE_WHISPER_LOCAL=true
ENABLE_WHISPER_DOCKER=true
WHISPER_MODELS_PATH=/opt/whisper/models
WHISPER_DEFAULT_MODEL=base
MAX_FILE_SIZE=524288000  # 500MB in bytes
```

## API Usage Example

```bash
# Upload and transcribe with hybrid routing
curl -X POST http://localhost:3002/api/whisper/transcribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@audio.mp3" \
  -F "method=auto" \
  -F "model=base" \
  -F "priority=balanced"

# Check service health
curl http://localhost:3002/api/whisper/health

# Get available models
curl http://localhost:3002/api/whisper/models
```

## Troubleshooting

### Common Issues

1. **Routes Not Found**: Ensure server is restarted after changes
2. **File Upload Errors**: Check file size limits and MIME types
3. **Authentication Errors**: Verify Bearer token is included
4. **Service Unavailable**: Check if Whisper services are initialized

### Debug Tips

- Check server logs for route registration confirmation
- Verify Whisper services initialization messages
- Use test script to validate endpoints
- Monitor error responses for specific codes

This migration ensures the Whisper API is fully integrated with the Fastify server architecture and maintains consistency with existing routes.