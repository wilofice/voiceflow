import React, { useState } from 'react';
import { Transcript } from '../types/api';
import { FileUpload } from '../components/transcription/FileUpload';
import { TranscriptList } from '../components/transcription/TranscriptList';
import { TranscriptDisplay } from '../components/transcription/TranscriptDisplay';
import { UserProfile } from '../components/auth/UserProfile';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '../components/ui/resizable';
import { 
  Upload, 
  List, 
  FileText, 
  Settings,
  Home,
  ArrowLeft
} from 'lucide-react';

type ViewMode = 'upload' | 'list' | 'transcript';

export function TranscriptionPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);

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

  const handleBackToUpload = () => {
    setViewMode('upload');
    setSelectedTranscript(null);
    setSelectedTranscriptId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">VoiceFlow Pro</h1>
            </div>
            
            <nav className="flex items-center space-x-1">
              <Button
                variant={viewMode === 'upload' ? 'default' : 'ghost'}
                size="sm"
                onClick={handleBackToUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                Transcripts
              </Button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <UserProfile compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {viewMode === 'upload' && (
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
        )}

        {viewMode === 'list' && (
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">My Transcripts</h2>
                <p className="text-gray-600">Manage and view your transcription history</p>
              </div>
              <Button onClick={handleBackToUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload New File
              </Button>
            </div>
            
            <TranscriptList 
              onTranscriptSelect={handleTranscriptSelect}
              onTranscriptView={handleTranscriptView}
              selectedTranscriptId={selectedTranscriptId}
            />
          </div>
        )}

        {viewMode === 'transcript' && selectedTranscriptId && (
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center space-x-4 mb-6">
              <Button variant="ghost" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Transcripts
              </Button>
              <div className="h-6 border-l border-gray-300"></div>
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
        )}
      </main>
    </div>
  );
}