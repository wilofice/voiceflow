import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/ui/app-shell';
import { NavigationSidebar } from '../components/ui/navigation-sidebar';
import { Dashboard } from '../components/ui/dashboard';
import { TranscriptEditor } from '../components/ui/transcript-editor';
import { BatchProcessor } from '../components/ui/batch-processor';
import { AIRecipePanel } from '../components/ui/ai-recipe-panel';
import { TranscriptionPage } from './TranscriptionPage';
import { useToast } from '../hooks/use-toast';
import { useUploadStore } from '../stores/uploadStore';
import { useTranscriptStore } from '../stores/transcriptStore';
import { apiClient } from '../services/apiClient';

type View = 'dashboard' | 'transcripts' | 'transcript-editor' | 'batch-processing' | 'ai-recipes' | 'settings';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const VoiceFlowPro: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { toast } = useToast();
  const { uploadFile } = useUploadStore();
  const { createTranscript, transcripts, fetchTranscripts } = useTranscriptStore();

  // Fetch transcripts on mount
  useEffect(() => {
    fetchTranscripts();
    
    // Check Whisper service health
    apiClient.getWhisperHealth()
      .then(health => {
        console.log('Whisper service health:', health);
      })
      .catch(error => {
        console.warn('Whisper service not available:', error);
      });
  }, [fetchTranscripts]);

  // Convert transcripts for dashboard display
  const dashboardTranscripts = transcripts?.slice(0, 5).map(transcript => ({
    id: transcript.id,
    title: transcript.title,
    duration: formatDuration(transcript.duration),
    timestamp: formatTimestamp(transcript.createdAt),
    status: transcript.status.toLowerCase() as 'completed' | 'processing' | 'error' | 'queued',
    confidence: 95,
    starred: false,
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

  const handleNavigation = (item: NavigationItem) => {
    switch (item.id) {
      case 'home':
        setCurrentView('dashboard');
        break;
      case 'transcripts':
      case 'all-transcripts':
        setCurrentView('transcripts');
        break;
      case 'transcribe':
        toast({
          title: "New Transcription",
          description: "Starting new transcription workflow...",
        });
        break;
      case 'batch':
        setCurrentView('batch-processing');
        break;
      case 'realtime':
        toast({
          title: "Live Transcription",
          description: "Opening realtime transcription console...",
        });
        break;
      case 'starred':
        setCurrentView('transcripts');
        toast({
          title: "Starred Transcripts",
          description: "Showing starred transcripts...",
        });
        break;
      case 'recent':
        setCurrentView('transcripts');
        toast({
          title: "Recent Transcripts",
          description: "Showing recent transcripts...",
        });
        break;
      case 'settings':
        setCurrentView('settings');
        break;
      default:
        toast({
          title: "Navigation",
          description: `Navigating to ${item.label}...`,
        });
    }
  };

  const handleUrlSubmit = (url: string) => {
    toast({
      title: "URL Processing",
      description: `Starting transcription for: ${url}`,
    });
  };

  const handleQuickAction = (action: any) => {
    switch (action.id) {
      case 'upload':
        // Trigger file browser for upload
        triggerFileBrowser();
        break;
      case 'record':
        toast({
          title: "Recording Started", 
          description: "Microphone recording has begun.",
        });
        break;
      case 'batch':
        setCurrentView('batch-processing');
        break;
      case 'system-audio':
        toast({
          title: "System Audio Capture",
          description: "Setting up system audio recording...",
          variant: "default",
        });
        break;
      default:
        toast({
          title: action.title,
          description: action.description,
        });
    }
  };

  // File browser trigger function
  const triggerFileBrowser = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.aiff,.caf,.ogg,.opus';
    input.style.display = 'none';
    
    input.onchange = (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        handleFilesDrop(files);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // Handle file drops and uploads with Whisper transcription
  const handleFilesDrop = async (files: File[]) => {
    try {
      toast({
        title: "Upload Started",
        description: `Processing ${files.length} file(s)...`,
      });

      for (const file of files) {
        console.log('Starting upload and transcription for:', file.name);
        
        // Step 1: Upload file to backend
        const uploadResponse = await uploadFile(file, { title: file.name });
        console.log('Upload completed:', uploadResponse);
        
        // Step 2: Try standard transcript creation first
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
      
      toast({
        title: "Upload Complete",
        description: `Successfully processed ${files.length} file(s)`,
      });

      // Navigate to transcripts view to see results
      setCurrentView('transcripts');
    } catch (error) {
      console.error('Failed to upload and transcribe files:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to process files. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTranscriptSelect = (transcript: any) => {
    setCurrentView('transcript-editor');
    toast({
      title: "Opening Transcript",
      description: `Loading: ${transcript.title}`,
    });
  };

  const renderMainContent = () => {
    switch (currentView) {
      case 'transcripts':
        return (
          <TranscriptionPage />
        );
      case 'transcript-editor':
        return (
          <div className="flex h-full">
            <TranscriptEditor 
              className="flex-1"
              onPlay={() => toast({ title: "Audio", description: "Playback started" })}
              onPause={() => toast({ title: "Audio", description: "Playback paused" })}
              onSeek={(time) => console.log('Seeking to:', time)}
            />
            <AIRecipePanel
              className="w-96"
              onExecute={(recipe, variables) => {
                toast({
                  title: "AI Recipe Executing",
                  description: `Running ${recipe.name}...`,
                });
              }}
            />
          </div>
        );
      case 'batch-processing':
        return (
          <BatchProcessor 
            onStart={() => toast({ title: "Batch Processing", description: "Starting batch job..." })}
            onPause={() => toast({ title: "Batch Processing", description: "Pausing batch job..." })}
            onStop={() => toast({ title: "Batch Processing", description: "Stopping batch job..." })}
          />
        );
      case 'ai-recipes':
        return (
          <AIRecipePanel 
            onExecute={(recipe, variables) => {
              toast({
                title: "AI Recipe Executing",
                description: `Running ${recipe.name}...`,
              });
            }}
          />
        );
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-4">
                Settings
              </h2>
              <p className="text-text-secondary">
                Settings panel coming soon...
              </p>
            </div>
          </div>
        );
      default:
        return (
          <Dashboard 
            onUrlSubmit={handleUrlSubmit}
            onQuickAction={handleQuickAction}
            onTranscriptSelect={handleTranscriptSelect}
            onFilesDrop={handleFilesDrop}
            onBrowseFiles={triggerFileBrowser}
            recentTranscripts={dashboardTranscripts}
          />
        );
    }
  };

  return (
    <AppShell
      sidebar={
        <NavigationSidebar 
          onNavigate={handleNavigation}
        />
      }
    >
      {renderMainContent()}
    </AppShell>
  );
};

export default VoiceFlowPro;