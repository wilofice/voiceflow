#!/bin/bash

# Test script for Whisper API endpoints
# This script tests the converted Fastify Whisper routes

API_BASE="http://localhost:3002/api"
TOKEN="your-auth-token-here" # Replace with actual token

echo "🧪 Testing Whisper API Endpoints..."
echo "================================"

# Test health endpoint (no auth required)
echo ""
echo "1. Testing /api/whisper/health (GET - No Auth)"
curl -X GET "${API_BASE}/whisper/health" \
  -H "Content-Type: application/json" | jq

# Test models endpoint (no auth required)
echo ""
echo "2. Testing /api/whisper/models (GET - No Auth)"
curl -X GET "${API_BASE}/whisper/models" \
  -H "Content-Type: application/json" | jq

# Test performance endpoint (auth required)
echo ""
echo "3. Testing /api/whisper/performance (GET - Auth Required)"
curl -X GET "${API_BASE}/whisper/performance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" | jq

# Test monitoring endpoints
echo ""
echo "4. Testing /api/whisper/monitoring/overall (GET - Auth Required)"
curl -X GET "${API_BASE}/whisper/monitoring/overall" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" | jq

echo ""
echo "5. Testing /api/whisper/monitoring/alerts (GET - Auth Required)"
curl -X GET "${API_BASE}/whisper/monitoring/alerts?limit=10" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" | jq

# Test transcription endpoint with sample file
echo ""
echo "6. Testing /api/whisper/transcribe (POST - Auth Required)"
echo "Note: Requires an actual audio file to test properly"

# Create a sample test file (you can replace with actual audio file)
SAMPLE_FILE="/tmp/test-audio.wav"
if [ -f "$SAMPLE_FILE" ]; then
  curl -X POST "${API_BASE}/whisper/transcribe" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${SAMPLE_FILE}" \
    -F "method=auto" \
    -F "model=base" \
    -F "language=en" \
    -F "priority=balanced" | jq
else
  echo "⚠️  No sample audio file found at ${SAMPLE_FILE}"
  echo "   To test transcription, provide an audio file"
fi

echo ""
echo "✅ Whisper API endpoint tests completed!"
echo ""
echo "📝 Summary:"
echo "- Health check endpoint: /api/whisper/health"
echo "- Models endpoint: /api/whisper/models"
echo "- Performance metrics: /api/whisper/performance"
echo "- Monitoring status: /api/whisper/monitoring/overall"
echo "- Monitoring alerts: /api/whisper/monitoring/alerts"
echo "- Transcription: /api/whisper/transcribe"
echo ""
echo "🔒 Note: Most endpoints require authentication"
echo "   Update the TOKEN variable with a valid auth token"