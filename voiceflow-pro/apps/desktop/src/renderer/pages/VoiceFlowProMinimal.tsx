import React, { useState } from 'react';
import { Upload, Mic, MonitorSpeaker, Cloud, FileAudio, Zap } from 'lucide-react';

interface VoiceFlowProMinimalProps {
  onUrlSubmit?: (url: string) => void;
  onQuickAction?: (action: string) => void;
}

export default function VoiceFlowProMinimal({ onUrlSubmit, onQuickAction }: VoiceFlowProMinimalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-3">
            <MonitorSpeaker className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold">VoiceFlow Pro</h1>
              <p className="text-sm text-gray-400">Advanced Audio Transcription</p>
            </div>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-sm">Ready</span>
            </div>
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
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Upload files, paste URLs, or record directly. Support for multiple formats with real-time processing.
          </p>
        </section>

        {/* URL Input */}
        <div className="max-w-2xl mx-auto bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold">Import from URL</h3>
            </div>
            <p className="text-gray-400">
              Paste a URL from YouTube, Vimeo, or any audio/video source
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit" 
                disabled={!url.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md flex items-center gap-2 transition-colors"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Process
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Quick Actions */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-center">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { id: 'upload', label: 'Upload Audio', icon: Upload, description: 'Upload audio files for transcription' },
              { id: 'record', label: 'Record Audio', icon: Mic, description: 'Record audio directly' },
              { id: 'import-folder', label: 'Import Folder', icon: FileAudio, description: 'Import entire folders' },
            ].map((action) => (
              <div 
                key={action.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 cursor-pointer hover:bg-slate-750 hover:border-slate-600 transition-colors"
                onClick={() => handleQuickAction(action.id)}
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <action.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{action.label}</h4>
                  <p className="text-gray-400 text-sm">{action.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-center">Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Zap, label: 'Fast Processing', color: 'blue' },
              { icon: FileAudio, label: 'Multiple Formats', color: 'green' },
              { icon: Cloud, label: 'URL Import', color: 'purple' },
              { icon: Mic, label: 'Live Recording', color: 'orange' },
            ].map((feature, index) => (
              <div key={index} className="text-center space-y-2">
                <div className={`w-10 h-10 bg-${feature.color}-500/20 rounded-lg flex items-center justify-center mx-auto`}>
                  <feature.icon className={`w-5 h-5 text-${feature.color}-400`} />
                </div>
                <div className="text-sm font-medium">{feature.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}