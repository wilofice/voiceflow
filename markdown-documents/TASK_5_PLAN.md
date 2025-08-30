# Task 5 Implementation Plan: Supabase Integration and Authentication

## Overview
This task involves integrating Supabase for authentication and file storage, replacing our current basic JWT implementation with a production-ready authentication system.

## Prerequisites

### 1. Supabase Project Setup
- [ ] Create a new Supabase project at https://supabase.com
- [ ] Note down the project URL and anon key
- [ ] Generate a service role key for backend operations
- [ ] Configure authentication settings (email confirmations, redirects, etc.)

### 2. Database Migration Strategy
**Current State**: We have a Prisma schema with local PostgreSQL
**Target State**: Migrate to Supabase PostgreSQL with RLS policies

**Migration Options**:
1. **Recommended**: Use Supabase as the database backend for Prisma
2. Alternative: Keep Prisma locally and sync auth state

### 3. Environment Variables Required
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_JWT_SECRET="your-jwt-secret"

# Storage Configuration
SUPABASE_STORAGE_BUCKET="audio-files"
```

## Implementation Plan

### Phase 1: Database Migration & Setup (30 minutes)

#### 1.1 Update Prisma Configuration
- Update `DATABASE_URL` in schema.prisma to point to Supabase PostgreSQL
- Run migrations on Supabase database
- Test database connection

#### 1.2 Supabase Table Setup
- Enable Row Level Security (RLS) on all tables
- Create RLS policies for user data isolation
- Set up storage bucket for audio files

### Phase 2: Backend Integration (45 minutes)

#### 2.1 Supabase Client Setup
**File**: `apps/api/src/lib/supabase.ts`
- Configure Supabase client with service role key
- Create helper functions for user management
- Add session verification utilities

#### 2.2 Authentication Middleware Update
**File**: `apps/api/src/middleware/auth.ts`
- Replace custom JWT validation with Supabase JWT verification
- Add user session management
- Handle token refresh logic

#### 2.3 Updated Route Handlers
**Files**: `apps/api/src/routes/auth.ts`
- Update login/register to use Supabase Auth
- Add password reset functionality
- Implement proper session management

### Phase 3: Frontend Integration (60 minutes)

#### 3.1 Supabase Client Setup
**File**: `apps/web/lib/supabase.ts`
- Configure Supabase client for frontend
- Set up TypeScript types
- Create auth helper functions

#### 3.2 Authentication Context
**File**: `apps/web/lib/auth-context.tsx`
- Create React context for auth state
- Handle authentication state changes
- Manage session persistence

#### 3.3 Authentication Components
**Files**:
- `apps/web/components/auth/LoginForm.tsx`
- `apps/web/components/auth/RegisterForm.tsx`  
- `apps/web/components/auth/ResetPasswordForm.tsx`
- `apps/web/components/auth/ProtectedRoute.tsx`

#### 3.4 Authentication Pages
**Files**:
- `apps/web/app/auth/login/page.tsx`
- `apps/web/app/auth/register/page.tsx`
- `apps/web/app/auth/reset-password/page.tsx`

### Phase 4: File Storage Integration (45 minutes)

#### 4.1 Storage Service
**File**: `apps/api/src/services/storage.ts`
- Implement file upload to Supabase Storage
- Add file validation and security checks
- Handle file deletion and cleanup

#### 4.2 Upload Route Updates
**File**: `apps/api/src/routes/upload.ts`
- Replace local storage simulation with Supabase Storage
- Add proper file access URLs
- Implement RLS for file access

### Phase 5: Security Implementation (30 minutes)

#### 5.1 Row Level Security Policies
**Supabase SQL Policies**:
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);

-- Users can only access their own transcripts
CREATE POLICY "Users can view own transcripts" ON transcripts FOR SELECT USING (auth.uid() = user_id);

-- File storage policies
CREATE POLICY "Users can upload own files" ON storage.objects FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

#### 5.2 API Security Updates
- Update CORS configuration for Supabase
- Add rate limiting for auth endpoints
- Implement proper error handling

## Testing Strategy

### 1. Automated Tests

#### 1.1 Backend API Tests
**File**: `apps/api/src/tests/auth.test.ts`
```typescript
describe('Authentication API', () => {
  test('should register a new user', async () => {
    // Test user registration with Supabase
  });
  
  test('should login existing user', async () => {
    // Test login flow
  });
  
  test('should validate JWT tokens', async () => {
    // Test token validation middleware
  });
  
  test('should handle password reset', async () => {
    // Test password reset flow
  });
});
```

#### 1.2 Frontend Component Tests
**File**: `apps/web/components/auth/__tests__/LoginForm.test.tsx`
```typescript
describe('LoginForm', () => {
  test('should submit login form', async () => {
    // Test form submission
  });
  
  test('should show validation errors', async () => {
    // Test form validation
  });
  
  test('should redirect after successful login', async () => {
    // Test navigation
  });
});
```

#### 1.3 Integration Tests
**File**: `apps/api/src/tests/integration/auth-flow.test.ts`
```typescript
describe('Full Authentication Flow', () => {
  test('complete user journey: register -> verify -> login -> access protected resource', async () => {
    // End-to-end auth flow test
  });
});
```

### 2. Manual Testing Checklist

#### 2.1 Authentication Flow
- [ ] User registration with email validation
- [ ] User login with correct credentials
- [ ] Login failure with incorrect credentials
- [ ] Password reset email sending
- [ ] Password reset completion
- [ ] Session persistence across browser refresh
- [ ] Automatic token refresh
- [ ] Logout functionality

#### 2.2 Protected Routes
- [ ] Unauthenticated users redirected to login
- [ ] Authenticated users can access dashboard
- [ ] Session expiry handling
- [ ] Multiple tab session sync

#### 2.3 File Storage
- [ ] File upload with authentication
- [ ] File access URL generation
- [ ] File deletion
- [ ] Storage permission validation
- [ ] File type validation
- [ ] File size limits

### 3. Performance Testing

#### 3.1 Authentication Performance
```typescript
// Test auth performance
test('authentication should complete within 2 seconds', async () => {
  const start = Date.now();
  await authService.login(credentials);
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(2000);
});
```

#### 3.2 File Upload Performance
```typescript
// Test file upload performance
test('file upload should handle large files', async () => {
  const largeFile = createMockFile(50 * 1024 * 1024); // 50MB
  const result = await uploadService.uploadFile(largeFile);
  expect(result.success).toBe(true);
});
```

## Database Schema Updates Required

### 1. User Table Sync
Since we're moving to Supabase Auth, we need to:
- Keep our existing `users` table for additional user metadata
- Sync with Supabase Auth users via database triggers
- Update user references to use Supabase UUIDs

### 2. RLS Policies Setup
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_comments ENABLE ROW LEVEL SECURITY;

-- Create policies (detailed policies in implementation phase)
```

## Environment Setup Steps

### 1. Local Development
1. Update `.env` file with Supabase credentials
2. Run database migrations on Supabase
3. Seed development data
4. Configure storage buckets

### 2. Testing Environment
1. Create separate Supabase project for testing
2. Set up CI/CD environment variables
3. Configure test database reset scripts

## Success Metrics

### 1. Functional Requirements
- [ ] 100% of auth flows working
- [ ] All existing API endpoints migrated
- [ ] File storage fully functional
- [ ] RLS policies protecting data

### 2. Performance Requirements
- [ ] Login time < 2 seconds
- [ ] File upload supports up to 2GB files
- [ ] Page load time for authenticated users < 3 seconds

### 3. Security Requirements
- [ ] No authentication bypasses possible
- [ ] File access properly restricted
- [ ] SQL injection prevention via RLS
- [ ] XSS protection in auth forms

## Rollback Plan

If issues occur during implementation:
1. **Database**: Revert `DATABASE_URL` to local PostgreSQL
2. **Auth**: Keep existing JWT middleware as fallback
3. **Storage**: Use local file storage temporarily
4. **Frontend**: Graceful degradation to basic auth forms

## Time Estimate
- **Total**: 3.5 hours
- **Critical Path**: Database migration and backend auth integration
- **Testing**: Additional 1 hour for comprehensive testing

This plan ensures a systematic approach to integrating Supabase while maintaining system functionality and implementing proper testing at each stage.