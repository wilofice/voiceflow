"use client";

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { TranscriptionMethodSelector } from '@/components/transcription/TranscriptionMethodSelector';
import { RealTimeWhisper } from '@/components/transcription/RealTimeWhisper';
import { TranscriptionSettings } from '@/components/settings/TranscriptionSettings';
import { CostQualityComparison } from '@/components/transcription/CostQualityComparison';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSupabaseToken } from '@/lib/api-client';
import {
  Upload,
  Mic,
  Settings,
  FileAudio,
  Zap,
  Shield,
  Clock,
  X,
  CheckCircle
} from 'lucide-react';

export default function WhisperDemoPage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('openai');
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  // API base URL configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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

    // Handle browser transcription locally (no backend call)
    if (selectedMethod === 'browser') {
      try {
        // TODO: Implement browser-based transcription using RealTimeWhisper or WhisperEngine
        console.log('Browser transcription not implemented yet');
        
        // Simulate progress for now
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        await new Promise(resolve => setTimeout(resolve, 3000));
        setUploadProgress(100);
        
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          // Don't clear the file yet, show results first
          
          // Mock result for browser transcription
          const mockResult = {
            success: true,
            result: {
              text: 'This is a mock transcription result for browser-based processing. The actual Whisper engine would provide real transcription here.',
              method: 'whisper-browser',
              processingTime: 3000,
              cost: 0,
              language: 'en'
            }
          };
          
          setTranscriptionResult(mockResult);
          setShowResults(true);
        }, 1000);
        
      } catch (error) {
        console.error('Browser transcription failed:', error);
        setIsUploading(false);
        setUploadProgress(0);
        alert('Browser transcription failed: ' + (error as Error).message);
      }
      return;
    }

    // Handle server-side transcription (openai or server methods)
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Map frontend methods to API routes and parameters
      let apiRoute = '';
      let additionalParams: Record<string, string> = {};

      if (selectedMethod === 'openai') {
        apiRoute = `${API_BASE_URL}/api/whisper/transcribe`;
        additionalParams = {
          method: 'openai',
          model: 'base',
          priority: 'balanced',
          fallbackEnabled: 'true'
        };
      } else if (selectedMethod === 'server') {
        apiRoute = `${API_BASE_URL}/api/whisper/transcribe/local`;
        additionalParams = {
          model: 'base',
          task: 'transcribe'
        };
      }

      // Add additional parameters to form data
      Object.entries(additionalParams).forEach(([key, value]) => {
        formData.append(key, value);
      });

      console.log(`🎙️ Starting ${selectedMethod} transcription via ${apiRoute}`);

      // Get Supabase auth token
      const token = await getSupabaseToken();
      
      if (!token) {
        throw new Error('Authentication required. Please log in to use the transcription service.');
      }
      
      // Start upload with progress tracking
      const response = await fetch(apiRoute, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        // Note: Don't set Content-Type header, let browser set it for FormData
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          
          // Handle authentication errors specifically
          if (response.status === 401) {
            errorMessage = 'Authentication required. Please log in to use the transcription service.';
          } else if (response.status === 403) {
            errorMessage = 'Access denied. You may not have permission to use this transcription method.';
          } else if (response.status === 503) {
            errorMessage = `${selectedMethod === 'server' ? 'Local Whisper' : 'Docker Whisper'} service is not available. Please try another method.`;
          }
        } catch {
          // If we can't parse JSON, use the basic error message
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setUploadProgress(100);
      
      console.log('✅ Transcription successful:', result);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        // Don't clear the file yet, show results first
        
        // Store and display results
        setTranscriptionResult(result);
        setShowResults(true);
      }, 1000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
      
      // Show user-friendly error message
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      alert(`Transcription failed: ${errorMessage}`);
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
    <ProtectedRoute>
      <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
        <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            VoiceFlow Pro - Whisper Demo
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
                {/* Results Display */}
                {showResults && transcriptionResult && (
                  <Card className="mb-6 border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="w-5 h-5" />
                        Transcription Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Method:</span>
                            <div className="font-mono text-green-700">
                              {transcriptionResult.result?.method || selectedMethod}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Processing Time:</span>
                            <div className="font-mono text-green-700">
                              {transcriptionResult.result?.processingTime || 'Unknown'}ms
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Cost:</span>
                            <div className="font-mono text-green-700">
                              ${transcriptionResult.result?.cost || 0}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Language:</span>
                            <div className="font-mono text-green-700">
                              {transcriptionResult.result?.language || 'auto'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Transcription Text */}
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Transcription:</h4>
                          <div className="bg-white rounded-lg p-4 border border-green-200 max-h-40 overflow-y-auto">
                            <p className="text-gray-800 whitespace-pre-wrap">
                              {transcriptionResult.result?.text || transcriptionResult.text || 'No text returned'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => {
                              const text = transcriptionResult.result?.text || transcriptionResult.text || '';
                              navigator.clipboard.writeText(text);
                              alert('Transcription copied to clipboard!');
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Copy Text
                          </Button>
                          <Button 
                            onClick={() => {
                              setShowResults(false);
                              setTranscriptionResult(null);
                              setSelectedFile(null);
                            }}
                            variant="outline"
                            size="sm"
                          >
                            New Transcription
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cost/Quality Comparison */}
                {selectedFile && !showResults && (
                  <div className="mb-6">
                    <CostQualityComparison
                      fileSize={selectedFile.size / (1024 * 1024)} // Convert to MB
                      fileDuration={Math.round(selectedFile.size / 1000000 * 60)} // Rough estimate
                      selectedMethod={selectedMethod}
                      onMethodSelect={setSelectedMethod}
                    />
                  </div>
                )}

                {!showResults && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Method Selection */}
                    <div>
                      <TranscriptionMethodSelector
                        currentMethod={
                          selectedMethod === 'browser' ? 'whisper-browser' :
                          selectedMethod === 'server' ? 'whisper-server' :
                          selectedMethod as any
                        }
                        onMethodChange={(method) => {
                          // Map the internal method names to our frontend names
                          if (method === 'whisper-browser') {
                            setSelectedMethod('browser');
                          } else if (method === 'whisper-server') {
                            setSelectedMethod('server');
                          } else {
                            setSelectedMethod(method);
                          }
                        }}
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
                )}
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
      </Layout>
    </ProtectedRoute>
  );
}