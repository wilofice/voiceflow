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
  Clock,
  X
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            VoiceFlow Pro
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced audio transcription with AI-powered accuracy. 
            Choose between cloud-based processing or private local transcription.
          </p>
        </div>

        {/* Main Tabs */}
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="upload" className="data-[state=active]:bg-white">
                <Upload className="w-4 h-4 mr-2" />
                Upload & Transcribe
              </TabsTrigger>
              <TabsTrigger value="realtime" className="data-[state=active]:bg-white">
                <Mic className="w-4 h-4 mr-2" />
                Real-time
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-white">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-0">
              <div className="space-y-6">
                {/* Cost/Quality Comparison */}
                {selectedFile && (
                  <div className="mb-6">
                    <CostQualityComparison
                      fileSize={selectedFile.size / (1024 * 1024)} // Convert to MB
                      fileDuration={Math.round(selectedFile.size / 1000000 * 60)} // Rough estimate
                      selectedMethod={selectedMethod}
                      onMethodSelect={setSelectedMethod}
                    />
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Method Selection */}
                  <div>
                    <TranscriptionMethodSelector
                      currentMethod={selectedMethod as any}
                      onMethodChange={(method) => setSelectedMethod(method)}
                    />
                  </div>

                  {/* File Upload */}
                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileAudio className="w-5 h-5" />
                        Upload Audio File
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!selectedFile ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="audio-upload"
                          />
                          <label htmlFor="audio-upload" className="cursor-pointer block">
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
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium truncate flex-1 mr-2">
                                {selectedFile.name}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFile}
                                disabled={isUploading}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                              <span>{formatFileSize(selectedFile.size)}</span>
                              <span>•</span>
                              <span>{formatDuration(selectedFile)}</span>
                              <Badge variant="outline" className="ml-auto">
                                {selectedFile.type || 'audio'}
                              </Badge>
                            </div>
                          </div>

                          {/* Selected Method Info */}
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm">
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
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
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
              </div>
            </TabsContent>

            {/* Real-time Tab */}
            <TabsContent value="realtime" className="mt-0">
              <div className="max-w-4xl mx-auto">
                <RealTimeWhisper
                  onTranscriptUpdate={(segment) => {
                    console.log('New segment:', segment);
                  }}
                  onFullTranscriptUpdate={(fullText, segments) => {
                    console.log('Full transcript updated:', fullText, segments);
                  }}
                />
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0">
              <div className="max-w-4xl mx-auto">
                <TranscriptionSettings />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}