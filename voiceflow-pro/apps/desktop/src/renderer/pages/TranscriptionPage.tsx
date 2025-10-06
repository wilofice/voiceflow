import React, { useState, useRef, useEffect } from 'react';
import { Transcript } from '../types/api';
import { TranscriptList } from '../components/transcription/TranscriptList';
import { Button } from '../components/ui/button';
import { useUploadStore } from '../stores/uploadStore';
import { useTranscriptStore } from '../stores/transcriptStore';
import { apiClient } from '../services/apiClient';

export function TranscriptionPage() {
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile } = useUploadStore();
  const { createTranscript, transcripts, fetchTranscripts } = useTranscriptStore();


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
    // TODO: Navigate to transcript editor view in parent
    console.log('Selected transcript:', transcript);
  };

  const handleTranscriptView = (transcriptId: string) => {
    setSelectedTranscriptId(transcriptId);
    // TODO: Navigate to transcript editor view in parent
    console.log('View transcript:', transcriptId);
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
    <div className="flex-1 flex flex-col h-full">
      {/* Hidden file input for browse functionality */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.aiff,.caf,.ogg,.opus"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Main Content - Transcript List View */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">My Transcripts</h2>
              <p className="text-gray-600">Manage and view your transcription history</p>
            </div>
            <Button onClick={handleBrowseFiles}>
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
    </div>
  );
}