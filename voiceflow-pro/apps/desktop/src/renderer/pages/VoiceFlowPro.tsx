import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/ui/app-shell';
import { NavigationSidebar } from '@/components/ui/navigation-sidebar';
import { Dashboard } from '@/components/ui/dashboard';
import { TranscriptEditor } from '@/components/ui/transcript-editor';
import { BatchProcessor } from '@/components/ui/batch-processor';
import { AIRecipePanel } from '@/components/ui/ai-recipe-panel';
import { useToast } from '@/hooks/use-toast';

type View = 'dashboard' | 'transcript-editor' | 'batch-processing' | 'ai-recipes' | 'settings';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const VoiceFlowPro: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { toast } = useToast();

  // Connect to Electron APIs
  const electronAPI = (window as any).electronAPI;

  const handleNavigation = (item: NavigationItem) => {
    switch (item.id) {
      case 'home':
        setCurrentView('dashboard');
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
      default:
        toast({
          title: "Navigation",
          description: `Navigating to ${item.label}...`,
        });
    }
  };

  const handleUrlSubmit = async (url: string) => {
    if (!electronAPI?.urlIngest) {
      toast({
        title: "Error",
        description: "URL ingest service not available",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "URL Processing Started",
        description: `Processing: ${url}`,
      });

      // Validate URL first
      const validation = await electronAPI.urlIngest.validate(url);
      
      if (!validation.success || !validation.valid) {
        toast({
          title: "Invalid URL",
          description: validation.error || "The URL format is not supported",
          variant: "destructive",
        });
        return;
      }

      // Process the URL
      const result = await electronAPI.urlIngest.process(url, {
        autoTranscribe: true,
        transcriptionModel: 'base',
        transcriptionLanguage: 'auto',
        quality: 'best',
        format: 'mp3'
      });

      if (result.success) {
        toast({
          title: "Processing Started",
          description: `Job ID: ${result.jobId} - Download and transcription in progress`,
        });
      } else {
        toast({
          title: "Processing Failed",
          description: result.error || "Failed to start processing",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('URL processing error:', error);
      toast({
        title: "Error",
        description: "Failed to process URL",
        variant: "destructive",
      });
    }
  };

  const handleQuickAction = async (action: any) => {
    switch (action.id) {
      case 'upload':
        if (!electronAPI?.fileImport) {
          toast({
            title: "Error",
            description: "File import service not available",
            variant: "destructive",
          });
          return;
        }

        try {
          const result = await electronAPI.fileImport.openDialog();
          if (result.success && result.files?.length > 0) {
            toast({
              title: "Files Imported",
              description: `Successfully imported ${result.files.length} files`,
            });
          } else if (!result.success) {
            toast({
              title: "Import Cancelled",
              description: "No files were selected",
            });
          }
        } catch (error) {
          console.error('File import error:', error);
          toast({
            title: "Import Error",
            description: "Failed to import files",
            variant: "destructive",
          });
        }
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
        });
        break;

      default:
        toast({
          title: action.title,
          description: action.description,
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

  // Set up URL ingest event listeners
  useEffect(() => {
    if (!electronAPI?.urlIngest) return;

    const handleProgress = (progress: any) => {
      toast({
        title: `${progress.stage}: ${Math.round(progress.percent)}%`,
        description: progress.message,
      });
    };

    const handleComplete = (result: any) => {
      toast({
        title: "Processing Complete",
        description: `Successfully processed: ${result.url}`,
      });
    };

    const handleError = (error: any) => {
      toast({
        title: "Processing Error",
        description: error.error,
        variant: "destructive",
      });
    };

    // Add event listeners
    electronAPI.urlIngest.onProgress(handleProgress);
    electronAPI.urlIngest.onComplete(handleComplete);
    electronAPI.urlIngest.onError(handleError);

    // Cleanup
    return () => {
      electronAPI.urlIngest.removeProgressListener(handleProgress);
      electronAPI.urlIngest.removeCompleteListener(handleComplete);
      electronAPI.urlIngest.removeErrorListener(handleError);
    };
  }, [toast]);

  const renderMainContent = () => {
    switch (currentView) {
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
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Settings
              </h2>
              <p className="text-muted-foreground">
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