'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { TranscriptProgress } from '@/components/transcript/TranscriptProgress';
import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { TranscriptEditor } from '@/components/transcript/TranscriptEditor';
import { useAuth } from '@/lib/auth-context';
import { useTranscript } from '@/hooks/useTranscript';
import { formatDate, formatDuration } from '@/lib/utils';
import Link from 'next/link';

export default function TranscriptPage() {
  const { user } = useAuth();
  const params = useParams();
  const transcriptId = params.id as string;
  
  const { 
    transcript, 
    segments, 
    loading, 
    error, 
    retryTranscription 
  } = useTranscript(transcriptId);

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading transcript...</span>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error || !transcript) {
    return (
      <ProtectedRoute>
        <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Transcript</h2>
              <p className="text-red-600">{error || 'Transcript not found'}</p>
              <Link 
                href="/dashboard"
                className="inline-block mt-3 text-blue-600 hover:text-blue-700"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Link 
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-700 mb-2 inline-block"
                >
                  ← Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{transcript.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                  <span>Created {formatDate(transcript.createdAt)}</span>
                  {transcript.duration > 0 && (
                    <span>Duration: {formatDuration(transcript.duration)}</span>
                  )}
                  <span>Language: {transcript.language.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status/Progress Section */}
          {(transcript.status === 'QUEUED' || transcript.status === 'PROCESSING' || transcript.status === 'FAILED') && (
            <div className="mb-6">
              <TranscriptProgress
                status={transcript.status}
                progress={transcript.status === 'PROCESSING' ? 50 : 0}
                onRetry={transcript.status === 'FAILED' ? retryTranscription : undefined}
              />
            </div>
          )}

          {/* Audio Player - Only show if we have an audio URL and transcript is completed */}
          {transcript.audioUrl && transcript.status === 'COMPLETED' && (
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">Audio Player</h3>
              <AudioPlayer 
                src={transcript.audioUrl} 
                onTimeUpdate={(time) => {
                  // TODO: Highlight current segment based on time
                  console.log('Current time:', time);
                }}
              />
            </div>
          )}

          {/* Transcript Content */}
          {transcript.status === 'COMPLETED' && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Transcript</h3>
                  <div className="flex space-x-2">
                    <button className="text-sm text-blue-600 hover:text-blue-700">
                      Export TXT
                    </button>
                    <button className="text-sm text-blue-600 hover:text-blue-700">
                      Export SRT
                    </button>
                    <button className="text-sm text-blue-600 hover:text-blue-700">
                      Export VTT
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                {segments.length > 0 ? (
                  <TranscriptEditor
                    segments={segments}
                    onSegmentUpdate={(segmentId, newText) => {
                      console.log('Update segment:', segmentId, newText);
                      // TODO: Implement segment update API call
                    }}
                    onSegmentClick={(segment) => {
                      console.log('Clicked segment:', segment);
                      // TODO: Seek audio player to segment time
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      Transcript content will appear here once processing is complete.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State for Non-Completed Transcripts */}
          {transcript.status !== 'COMPLETED' && transcript.status !== 'FAILED' && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Transcription in Progress
              </h3>
              <p className="text-gray-600 mb-4">
                Your audio file is being processed. This may take a few minutes depending on the file size.
              </p>
              <div className="text-sm text-gray-500">
                Status: <span className="font-medium">{transcript.status}</span>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Transcript Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">ID:</span> {transcript.id}
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>{' '}
                <span className={`px-2 py-1 rounded text-xs ${
                  transcript.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  transcript.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                  transcript.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {transcript.status}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span> {formatDate(transcript.createdAt)}
              </div>
              <div>
                <span className="font-medium text-gray-700">Last Updated:</span> {formatDate(transcript.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}