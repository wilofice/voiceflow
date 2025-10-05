import React, { useState, useRef, useEffect } from 'react';
import { Transcript } from '../types/api';
import { FileUpload } from '../components/transcription/FileUpload';
import { TranscriptList } from '../components/transcription/TranscriptList';
import { TranscriptDisplay } from '../components/transcription/TranscriptDisplay';
import { UserProfile } from '../components/auth/UserProfile';
import { Dashboard } from '../components/ui/dashboard';
import { Button } from '../components/ui/button';
import { useUploadStore } from '../stores/uploadStore';
import { useTranscriptStore } from '../stores/transcriptStore';
import { apiClient } from '../services/apiClient';
import { 
  ArrowLeft,
  FileText
} from 'lucide-react';

type ViewMode = 'dashboard' | 'upload' | 'list' | 'transcript';

export function TranscriptionPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile } = useUploadStore();
  const { createTranscript, transcripts, fetchTranscripts } = useTranscriptStore();

  // Convert real transcripts to dashboard format
  const dashboardTranscripts = transcripts?.slice(0, 5).map(transcript => ({
    id: transcript.id,
    title: transcript.title,
    duration: formatDuration(transcript.duration),
    timestamp: formatTimestamp(transcript.createdAt),
    status: transcript.status.toLowerCase() as 'completed' | 'processing' | 'error' | 'queued',
    confidence: 95, // TODO: Add confidence to transcript type
    starred: false, // TODO: Add starred to transcript type
  })) || [];

  // Helper functions
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Fetch transcripts and check Whisper health on component mount
  useEffect(() => {
    fetchTranscripts();
    
    // Check if Whisper service is available
    apiClient.getWhisperHealth()
      .then(health => {
        console.log('Whisper service health:', health);
      })
      .catch(error => {
        console.warn('Whisper service not available:', error);
      });
  }, [fetchTranscripts]);

  const handleTranscriptSelect = (transcript: Transcript) => {
    setSelectedTranscript(transcript);
    setSelectedTranscriptId(transcript.id);
    setViewMode('transcript');
  };

  const handleTranscriptView = (transcriptId: string) => {
    setSelectedTranscriptId(transcriptId);
    setViewMode('transcript');
  };

  const handleUploadComplete = (uploadId: string) => {
    // Switch to list view to see the uploaded file
    setViewMode('list');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedTranscript(null);
    setSelectedTranscriptId(null);
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setSelectedTranscript(null);
    setSelectedTranscriptId(null);
  };

  // Handle dashboard quick actions
  const handleQuickAction = (action: any) => {
    switch (action.id) {
      case 'upload':
        setViewMode('upload');
        break;
      case 'record':
        // TODO: Implement recording functionality
        console.log('Recording functionality not implemented yet');
        break;
      case 'batch':
        // TODO: Implement batch processing
        console.log('Batch processing not implemented yet');
        break;
      default:
        console.log('Action not implemented:', action.id);
    }
  };

  // Handle URL transcription from dashboard
  const handleUrlSubmit = (url: string) => {
    // TODO: Implement URL transcription
    console.log('URL transcription not implemented yet:', url);
  };

  // Handle dashboard transcript selection (convert mock data to real selection)
  const handleDashboardTranscriptSelect = (transcript: any) => {
    setSelectedTranscriptId(transcript.id);
    setViewMode('transcript');
  };

  // Handle file drops from dashboard
  const handleFilesDrop = async (files: File[]) => {
    try {
      for (const file of files) {
        console.log('Starting upload and transcription for:', file.name);
        
        // Step 1: Upload file to backend
        const uploadResponse = await uploadFile(file, { title: file.name });
        console.log('Upload completed:', uploadResponse);
        
        // Step 2: Try to create transcript using the standard flow first
        // If this fails, we'll know the backend expects direct Whisper API calls
        try {
          const transcript = await createTranscript({ 
            uploadId: uploadResponse.id,
            title: file.name,
            language: 'auto'
          });
          console.log('Transcript created successfully:', transcript);
        } catch (transcriptError) {
          console.log('Standard transcript creation failed, trying direct Whisper API:', transcriptError);
          
          // Fallback: Use direct Whisper API with the original file
          const transcriptionResult = await apiClient.transcribeWithWhisper(
            file, // Pass the original File object for multipart upload
            {
              model: 'base',
              language: 'auto',
              task: 'transcribe'
            }
          );
          console.log('Direct Whisper transcription completed:', transcriptionResult);
        }
      }
      
      // Refresh transcript list
      await fetchTranscripts();
      
      // Switch to list view to see results
      setViewMode('list');
    } catch (error) {
      console.error('Failed to upload and transcribe files:', error);
    }
  };

  // Handle browse files button click
  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleFilesDrop(files);
    }
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">VoiceFlow Pro</h1>
            </div>
            
            {viewMode !== 'dashboard' && (
              <nav className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToDashboard}
                >
                  Home
                </Button>
                {viewMode === 'transcript' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Transcripts
                  </Button>
                )}
              </nav>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <UserProfile compact />
          </div>
        </div>
      </header>

      {/* Hidden file input for browse functionality */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.aiff,.caf,.ogg,.opus"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Main Content */}
      <main className="flex-1">
        {viewMode === 'dashboard' && (
          <Dashboard
            onUrlSubmit={handleUrlSubmit}
            onQuickAction={handleQuickAction}
            onTranscriptSelect={handleDashboardTranscriptSelect}
            onFilesDrop={handleFilesDrop}
            onBrowseFiles={handleBrowseFiles}
            recentTranscripts={dashboardTranscripts}
          />
        )}

        {viewMode === 'upload' && (
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-gray-900">
                  Upload Audio Files for Transcription
                </h2>
                <p className="text-lg text-gray-600">
                  Upload your audio or video files and get accurate transcriptions powered by AI
                </p>
              </div>
              
              <FileUpload onUploadComplete={handleUploadComplete} />
              
              {/* Quick Access to Recent Transcripts */}
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Transcripts</h3>
                  <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
                    View All
                  </Button>
                </div>
                <TranscriptList 
                  onTranscriptSelect={handleTranscriptSelect}
                  onTranscriptView={handleTranscriptView}
                  selectedTranscriptId={selectedTranscriptId}
                  compact
                />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">My Transcripts</h2>
                  <p className="text-gray-600">Manage and view your transcription history</p>
                </div>
                <Button onClick={() => setViewMode('upload')}>
                  Upload New File
                </Button>
              </div>
              
              <TranscriptList 
                onTranscriptSelect={handleTranscriptSelect}
                onTranscriptView={handleTranscriptView}
                selectedTranscriptId={selectedTranscriptId}
              />
            </div>
          </div>
        )}

        {viewMode === 'transcript' && selectedTranscriptId && (
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center space-x-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedTranscript?.title || 'Transcript Details'}
                  </h2>
                  <p className="text-gray-600">View and edit your transcription</p>
                </div>
              </div>
              
              <TranscriptDisplay 
                transcriptId={selectedTranscriptId}
                showAudioPlayer={true}
                editable={true}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}