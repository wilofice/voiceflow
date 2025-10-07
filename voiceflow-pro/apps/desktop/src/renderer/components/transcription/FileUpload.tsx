import { 
  Upload, 
  File, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Music,
  Video,
  Mic
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { useTranscriptStore } from '../../stores/transcriptStore';
import { useUploadStore } from '../../stores/uploadStore';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/mp4': ['.m4a'],
  'audio/ogg': ['.ogg'],
  'audio/opus': ['.opus'],
  'video/quicktime': ['.mov'],
  'video/mp4': ['.mp4'],
};

const MAX_FILE_SIZE = 2147483648; // 2GB
const MAX_FILES = 10;

interface FileUploadProps {
  onUploadComplete?: (uploadId: string) => void;
  compact?: boolean;
}

export function FileUpload({ onUploadComplete, compact = false }: FileUploadProps) {
  const { uploadFile, uploads, removeUpload, clearError, error } = useUploadStore();
  const { createTranscript } = useTranscriptStore();
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setDragActive(false);
    clearError();

    for (const file of acceptedFiles.slice(0, MAX_FILES)) {
      try {
        // Upload file
        const uploadResponse = await uploadFile(file, {
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          language: 'auto', // Auto-detect language
        });

        // Create transcript
        await createTranscript({
          uploadId: uploadResponse.uploadId,
          title: uploadResponse.fileName,
          language: 'auto',
        });

        if (onUploadComplete) {
          onUploadComplete(uploadResponse.uploadId);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  }, [uploadFile, createTranscript, onUploadComplete, clearError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropRejected: (rejectedFiles) => {
      const errors = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map(e => e.message).join(', ')}`
      );
      console.error('Files rejected:', errors);
    },
  });

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'opus':
      case 'm4a':
        return <Music className="h-4 w-4" />;
      case 'mp4':
      case 'mov':
        return <Video className="h-4 w-4" />;
      default:
        return <Mic className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadList = Object.values(uploads);
  const hasUploads = uploadList.length > 0;

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Upload Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive || dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">
            Drop audio files here or <span className="text-blue-600">browse</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            MP3, WAV, MP4, MOV up to 2GB
          </p>
        </div>

        {/* Upload Progress */}
        {hasUploads && (
          <div className="space-y-2">
            {uploadList.map((upload) => (
              <div key={upload.uploadId} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                {getFileIcon(upload.fileName)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.fileName}</p>
                  {upload.status === 'uploading' && (
                    <Progress value={upload.progress} className="h-1" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {upload.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {upload.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {upload.status === 'failed' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUpload(upload.uploadId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200
              ${isDragActive || dragActive 
                ? 'border-blue-500 bg-blue-50 scale-105' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isDragActive ? 'Drop files here' : 'Upload audio files'}
                </h3>
                <p className="text-gray-600 mt-1">
                  Drag and drop your audio or video files here, or click to browse
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">MP3</Badge>
                <Badge variant="secondary">WAV</Badge>
                <Badge variant="secondary">MP4</Badge>
                <Badge variant="secondary">MOV</Badge>
                <Badge variant="secondary">OGG</Badge>
                <Badge variant="secondary">OPUS</Badge>
              </div>

              <div className="text-sm text-gray-500 space-y-1">
                <p>Maximum file size: 2GB</p>
                <p>Up to {MAX_FILES} files at once</p>
              </div>

              <Button variant="outline" size="lg">
                Choose Files
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {hasUploads && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upload Progress</h3>
                <Badge variant="outline">
                  {uploadList.length} file{uploadList.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-3">
                {uploadList.map((upload) => (
                  <div key={upload.uploadId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(upload.fileName)}
                        <div>
                          <p className="font-medium">{upload.fileName}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(upload.total)}
                            {upload.status === 'uploading' && 
                              ` • ${upload.progress.toFixed(1)}% complete`
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {upload.status === 'uploading' && (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-sm font-medium">
                              {upload.progress.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        
                        {upload.status === 'completed' && (
                          <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                        )}
                        
                        {upload.status === 'failed' && (
                          <div className="flex items-center space-x-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Failed</span>
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUpload(upload.uploadId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {upload.status === 'uploading' && (
                      <Progress value={upload.progress} className="h-2" />
                    )}

                    {upload.status === 'failed' && upload.error && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-sm">
                          {upload.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}