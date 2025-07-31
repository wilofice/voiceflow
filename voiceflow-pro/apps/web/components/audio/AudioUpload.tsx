'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { formatFileSize } from '@/lib/utils';
import type { UploadProgress } from '@/types';

interface AudioUploadProps {
  onUpload: (files: File[]) => void;
  onProgress?: (progress: UploadProgress) => void;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
}

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/mp4': ['.m4a'],
  'audio/ogg': ['.ogg'],
  'audio/opus': ['.opus'],
  'video/quicktime': ['.mov'],
  'video/mp4': ['.mp4'],
};

export function AudioUpload({
  onUpload,
  onProgress,
  maxSize = 2 * 1024 * 1024 * 1024, // 2GB
  multiple = false,
  disabled = false,
}: AudioUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        // Handle rejected files
        rejectedFiles.forEach((rejection) => {
          console.error('File rejected:', rejection.file.name, rejection.errors);
        });
        return;
      }

      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize,
    multiple,
    disabled,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${
            isDragActive || dropzoneActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="text-4xl mb-4">
          {isDragActive || dropzoneActive ? '📁' : '🎙️'}
        </div>
        
        <div className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive || dropzoneActive
            ? 'Drop your audio files here'
            : 'Upload audio files'}
        </div>
        
        <div className="text-sm text-gray-600 mb-4">
          Drag and drop your files or click to browse
        </div>
        
        <div className="text-xs text-gray-500">
          Supported formats: MP3, WAV, M4A, OGG, OPUS, MOV, MP4
          <br />
          Maximum file size: {formatFileSize(maxSize)}
        </div>
      </div>

      {uploadProgress.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadProgress.map((progress) => (
            <div key={progress.uploadId} className="bg-white p-3 rounded border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium truncate">
                  {progress.fileName}
                </span>
                <span className="text-xs text-gray-500">
                  {progress.progress}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    progress.status === 'error'
                      ? 'bg-red-500'
                      : progress.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              
              {progress.error && (
                <div className="text-xs text-red-600 mt-1">
                  {progress.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}