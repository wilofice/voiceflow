import { Upload, Mic, Zap, MonitorSpeaker, Cloud, FileAudio } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface VoiceFlowProSimpleProps {
  onUrlSubmit?: (url: string) => void;
  onQuickAction?: (action: string) => void;
}

export default function VoiceFlowProSimple({ onUrlSubmit, onQuickAction }: VoiceFlowProSimpleProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsLoading(true);
    try {
      if (onUrlSubmit) {
        await onUrlSubmit(url);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    if (onQuickAction) {
      onQuickAction(action);
    }
  };

  const quickActions = [
    { id: 'upload', label: 'Upload Audio', icon: Upload, description: 'Upload audio files for transcription' },
    { id: 'record', label: 'Record Audio', icon: Mic, description: 'Record audio directly' },
    { id: 'import-folder', label: 'Import Folder', icon: FileAudio, description: 'Import entire folders' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b bg-slate-800">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-3">
            <MonitorSpeaker className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold">VoiceFlow Pro</h1>
              <p className="text-sm text-gray-400">Advanced Audio Transcription</p>
            </div>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Ready
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">
            Transform Audio to Text with AI
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload files, paste URLs, or record directly. Support for multiple formats with real-time processing.
          </p>
        </section>

        {/* URL Input */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Import from URL
            </CardTitle>
            <CardDescription>
              Paste a URL from YouTube, Vimeo, or any audio/video source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!url.trim() || isLoading}
                className="shrink-0"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Process
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-center">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {quickActions.map((action) => (
              <Card 
                key={action.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleQuickAction(action.id)}
              >
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <action.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{action.label}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-center">Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm font-medium">Fast Processing</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto">
                <FileAudio className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-sm font-medium">Multiple Formats</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto">
                <Cloud className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-sm font-medium">URL Import</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto">
                <Mic className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-sm font-medium">Live Recording</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}