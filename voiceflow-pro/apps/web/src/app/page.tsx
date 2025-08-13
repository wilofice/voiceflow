"use client";

import { useState } from 'react';
import { TranscriptionMethodSelector } from '@/components/transcription/TranscriptionMethodSelector';
import { RealTimeWhisper } from '@/components/transcription/RealTimeWhisper';
import { TranscriptionSettings } from '@/components/settings/TranscriptionSettings';
import { CostQualityComparison } from '@/components/transcription/CostQualityComparison';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Mic,
  Settings,
  FileAudio,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('openai');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log('Selected file:', file.name, 'Size:', file.size);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // TODO: Implement actual upload logic with transcription method selection
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate upload
      
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setSelectedFile(null);
        // TODO: Navigate to transcription results
      }, 1000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (file: File) => {
    // TODO: Get actual audio duration
    return '~' + Math.round(file.size / 1000000 * 60) + 's';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            VoiceFlow Pro
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced audio transcription with AI-powered accuracy. 
            Choose between cloud-based processing or private local transcription.
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="upload" className="w-full max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload & Transcribe</span>
            </TabsTrigger>
            <TabsTrigger value="realtime" className="flex items-center space-x-2">
              <Mic className="w-4 h-4" />
              <span>Real-time</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            {/* Cost/Quality Comparison */}
            {selectedFile && (
              <CostQualityComparison
                fileSize={selectedFile.size / (1024 * 1024)} // Convert to MB
                fileDuration={Math.round(selectedFile.size / 1000000 * 60)} // Rough estimate
                selectedMethod={selectedMethod}
                onMethodSelect={setSelectedMethod}
              />
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Method Selection */}
              <div>
                <TranscriptionMethodSelector
                  currentMethod={selectedMethod as any}
                  onMethodChange={(method) => setSelectedMethod(method)}
                />
              </div>

              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileAudio className="w-5 h-5" />
                    <span>Upload Audio File</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedFile ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="audio-upload"
                      />
                      <label htmlFor="audio-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          Click to upload audio file
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports MP3, WAV, M4A, FLAC and more
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Maximum file size: 500MB
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* File Info */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{selectedFile.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFile}
                            disabled={isUploading}
                          >
                            ×
                          </Button>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{formatFileSize(selectedFile.size)}</span>
                          <span>{formatDuration(selectedFile)}</span>
                          <Badge variant="outline">{selectedFile.type}</Badge>
                        </div>
                      </div>

                      {/* Selected Method Info */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm">
                          {selectedMethod === 'openai' && (
                            <>
                              <Zap className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-800">OpenAI Whisper API - Fast & Accurate</span>
                            </>
                          )}
                          {selectedMethod === 'browser' && (
                            <>
                              <Shield className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-800">Browser Whisper - Private & Local</span>
                            </>
                          )}
                          {selectedMethod === 'server' && (
                            <>
                              <Clock className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-800">Server Whisper - Balanced Performance</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Upload Progress */}
                      {isUploading && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Processing...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Upload Button */}
                      <Button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="w-full"
                        size="lg"
                      >
                        {isUploading ? 'Processing...' : 'Start Transcription'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="realtime">
            <RealTimeWhisper
              onTranscriptUpdate={(segment) => {
                console.log('New segment:', segment);
              }}
              onFullTranscriptUpdate={(fullText, segments) => {
                console.log('Full transcript updated:', fullText, segments);
              }}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <TranscriptionSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}