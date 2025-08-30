# VoiceFlow Pro API Documentation

## Overview

The VoiceFlow Pro API provides endpoints for audio transcription, user management, and real-time collaboration features.

Base URL: `http://localhost:3001/api` (development)

## Authentication

All API endpoints (except auth endpoints) require JWT authentication.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### POST /api/auth/login
Login an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### GET /api/auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "FREE"
  }
}
```

### File Upload

#### POST /api/upload/audio
Upload an audio file for transcription.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- `file`: Audio file (mp3, wav, m4a, ogg, opus, mov, mp4)
- `title`: Optional title for the transcription

**Response:**
```json
{
  "uploadId": "uuid",
  "fileName": "audio.mp3",
  "fileSize": 1048576,
  "status": "QUEUED",
  "transcriptId": "uuid"
}
```

### Transcriptions

#### GET /api/transcripts
Get all transcriptions for the current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status (QUEUED, PROCESSING, COMPLETED, FAILED)

**Response:**
```json
{
  "transcripts": [
    {
      "id": "uuid",
      "title": "Meeting Recording",
      "duration": 3600,
      "language": "en",
      "status": "COMPLETED",
      "audioUrl": "https://storage.url/audio.mp3",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T01:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### POST /api/transcripts
Create a new transcription from uploaded file.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "uploadId": "uuid",
  "title": "Meeting Recording",
  "language": "en"
}
```

**Response:**
```json
{
  "transcript": {
    "id": "uuid",
    "title": "Meeting Recording",
    "status": "QUEUED",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /api/transcripts/:id
Get a specific transcription with segments.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "transcript": {
    "id": "uuid",
    "title": "Meeting Recording",
    "duration": 3600,
    "language": "en",
    "status": "COMPLETED",
    "audioUrl": "https://storage.url/audio.mp3",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T01:00:00Z",
    "segments": [
      {
        "id": "uuid",
        "startTime": 0.0,
        "endTime": 5.5,
        "text": "Hello, welcome to the meeting.",
        "speakerId": "SPEAKER_1",
        "confidence": 0.95
      }
    ]
  }
}
```

#### PUT /api/transcripts/:id
Update a transcription.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "segments": [
    {
      "id": "uuid",
      "text": "Updated text"
    }
  ]
}
```

**Response:**
```json
{
  "transcript": {
    "id": "uuid",
    "title": "Updated Title",
    "updatedAt": "2024-01-01T02:00:00Z"
  }
}
```

#### DELETE /api/transcripts/:id
Delete a transcription.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

### WebSocket Events

Connect to WebSocket at `ws://localhost:3001` with JWT token.

#### Events

**transcript:progress**
```json
{
  "transcriptId": "uuid",
  "progress": 45,
  "status": "PROCESSING"
}
```

**transcript:completed**
```json
{
  "transcriptId": "uuid",
  "status": "COMPLETED"
}
```

**transcript:error**
```json
{
  "transcriptId": "uuid",
  "status": "FAILED",
  "error": "Error message"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints are rate limited to 100 requests per 15 minutes per user.

Rate limit headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets