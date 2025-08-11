'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { AudioUpload } from '@/components/audio/AudioUpload';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase';
import type { UploadProgress } from '@/types';

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleUpload = async (files: File[]) => {
    if (!user) return;

    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Process each file
      for (const file of files) {
        const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        // Add initial upload progress
        const initialProgress: UploadProgress = {
          uploadId,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        };
        
        setUploads(prev => [...prev, initialProgress]);

        try {
          // Create FormData for multipart upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', file.name.replace(/\.[^/.]+$/, "")); // Remove extension
          formData.append('language', 'en'); // Default to English

          // Upload to backend
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/upload/audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Upload failed');
          }

          const result = await response.json();

          // Update progress to completed
          setUploads(prev => 
            prev.map(upload => 
              upload.uploadId === uploadId
                ? { ...upload, progress: 100, status: 'completed' as const }
                : upload
            )
          );

          // Optional: Redirect to transcript after successful upload
          setTimeout(() => {
            router.push(`/transcripts/${result.transcriptId}`);
          }, 2000);

        } catch (error: any) {
          // Update progress with error
          setUploads(prev => 
            prev.map(upload => 
              upload.uploadId === uploadId
                ? { 
                    ...upload, 
                    status: 'error' as const, 
                    error: error.message || 'Upload failed' 
                  }
                : upload
            )
          );
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const clearCompletedUploads = () => {
    setUploads(prev => prev.filter(upload => upload.status !== 'completed'));
  };

  const retryFailedUpload = (uploadId: string) => {
    // Remove failed upload to allow retry
    setUploads(prev => prev.filter(upload => upload.uploadId !== uploadId));
  };

  return (
    <ProtectedRoute>
      <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Audio Files</h1>
            <p className="text-gray-600">
              Upload your audio files to transcribe them using AI. Supported formats include MP3, WAV, M4A, and more.
            </p>
          </div>

          {/* Upload Component */}
          <div className="mb-8">
            <AudioUpload
              onUpload={handleUpload}
              maxSize={2 * 1024 * 1024 * 1024} // 2GB
              multiple={true}
              disabled={isUploading}
            />
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Upload Progress</h2>
                <button
                  onClick={clearCompletedUploads}
                  className="text-sm text-gray-500 hover:text-gray-700"
                  disabled={!uploads.some(u => u.status === 'completed')}
                >
                  Clear Completed
                </button>
              </div>

              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div key={upload.uploadId} className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{upload.fileName}</h3>
                        <p className="text-sm text-gray-500">
                          {upload.status === 'uploading' && 'Uploading file...'}
                          {upload.status === 'processing' && 'Processing and preparing for transcription...'}
                          {upload.status === 'completed' && 'Upload completed! Redirecting to transcript...'}
                          {upload.status === 'error' && 'Upload failed'}
                        </p>
                      </div>
                      
                      {upload.status === 'error' && (
                        <button
                          onClick={() => retryFailedUpload(upload.uploadId)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          upload.status === 'error'
                            ? 'bg-red-500'
                            : upload.status === 'completed'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ 
                          width: upload.status === 'completed' ? '100%' : `${upload.progress}%` 
                        }}
                      />
                    </div>

                    {/* Progress Percentage */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        {upload.status === 'completed' ? '100%' : `${upload.progress}%`}
                      </span>
                      
                      {upload.status === 'completed' && (
                        <span className="text-green-600 font-medium">
                          ✅ Ready for transcription
                        </span>
                      )}
                      
                      {upload.status === 'error' && (
                        <span className="text-red-600 text-xs">
                          {upload.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">💡 Tips for better transcription</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use high-quality audio files for best results</li>
              <li>• Clear speech with minimal background noise works best</li>
              <li>• Supported formats: MP3, WAV, M4A, OGG, OPUS, MOV, MP4</li>
              <li>• Maximum file size: 2GB per file</li>
              <li>• Processing time depends on file length and complexity</li>
            </ul>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}