import React, { useState, useRef, useEffect } from 'react';

import { TranscriptList } from '../components/transcription/TranscriptList';
import { Button } from '../components/ui/button';
import { apiClient } from '../services/apiClient';
import { useTranscriptStore } from '../stores/transcriptStore';
import { useUploadStore } from '../stores/uploadStore';
import { Transcript } from '../types/api';

interface TranscriptionPageProps {
  onTranscriptSelect?: (transcript: Transcript) => void;
}

export function TranscriptionPage({ onTranscriptSelect }: TranscriptionPageProps) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // Auto-refresh transcripts when there are processing/queued items
  useEffect(() => {
    const hasActiveTranscripts = transcripts.some(
      t => t.status === 'PROCESSING' || t.status === 'QUEUED'
    );

    if (!hasActiveTranscripts) {
      return; // No active transcripts, no need to poll
    }

    console.log('[TranscriptionPage] Active transcripts detected, starting polling...');

    // Poll every 5 seconds when there are active transcriptions
    const pollInterval = setInterval(() => {
      console.log('[TranscriptionPage] Polling for transcript updates...');
      fetchTranscripts();
    }, 5000);

    return () => {
      console.log('[TranscriptionPage] Stopping polling');
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcripts]); // Re-run when transcripts change, not when fetchTranscripts reference changes

  const handleTranscriptSelect = (transcript: Transcript) => {
    setSelectedTranscript(transcript);
    setSelectedTranscriptId(transcript.id);

    // Navigate to transcript editor view in parent
    if (onTranscriptSelect) {
      onTranscriptSelect(transcript);
    }
  };

  const handleTranscriptView = (transcriptId: string) => {
    // Find the transcript by ID and navigate to it
    const transcript = transcripts.find(t => t.id === transcriptId);
    if (transcript && onTranscriptSelect) {
      onTranscriptSelect(transcript);
    }
  };

  // Handle file drops from dashboard
  const handleFilesDrop = async (files: File[]) => {
    try {
      for (const file of files) {
        console.log('Starting upload for:', file.name);

        // Upload file to backend - this automatically creates the transcript
        // and queues it for transcription processing
        const uploadResponse = await uploadFile(file, {
          title: file.name,
          language: 'auto'
        });

        console.log('Upload completed:', uploadResponse);
        console.log('Transcript ID:', uploadResponse.transcriptId);
        console.log('Status:', uploadResponse.status);
      }

      // Refresh transcript list to show the new uploads
      await fetchTranscripts();
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