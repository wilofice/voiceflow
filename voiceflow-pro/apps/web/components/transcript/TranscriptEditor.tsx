'use client';

import { useState } from 'react';
import { formatDuration } from '@/lib/utils';
import type { TranscriptSegment, TranscriptViewMode } from '@/types';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  onSegmentUpdate?: (segmentId: string, text: string) => void;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  viewMode?: TranscriptViewMode;
  currentTime?: number;
  className?: string;
}

export function TranscriptEditor({
  segments,
  onSegmentUpdate,
  onSegmentClick,
  viewMode = {
    mode: 'segments',
    showTimestamps: true,
    showSpeakers: true,
    showConfidence: false,
  },
  currentTime = 0,
  className = '',
}: TranscriptEditorProps) {
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleSegmentClick = (segment: TranscriptSegment) => {
    onSegmentClick?.(segment);
  };

  const handleEditStart = (segment: TranscriptSegment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
  };

  const handleEditSave = (segmentId: string) => {
    onSegmentUpdate?.(segmentId, editText);
    setEditingSegment(null);
    setEditText('');
  };

  const handleEditCancel = () => {
    setEditingSegment(null);
    setEditText('');
  };

  const isCurrentSegment = (segment: TranscriptSegment) => {
    return currentTime >= segment.startTime && currentTime <= segment.endTime;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white border rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transcript</h3>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={viewMode.showTimestamps}
              onChange={() => {/* Handle viewMode change */}}
              className="rounded"
            />
            <span>Timestamps</span>
          </label>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={viewMode.showSpeakers}
              onChange={() => {/* Handle viewMode change */}}
              className="rounded"
            />
            <span>Speakers</span>
          </label>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={viewMode.showConfidence}
              onChange={() => {/* Handle viewMode change */}}
              className="rounded"
            />
            <span>Confidence</span>
          </label>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {segments.map((segment) => (
          <div
            key={segment.id}
            className={`
              p-3 rounded border cursor-pointer transition-all
              ${
                isCurrentSegment(segment)
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50 border-gray-200'
              }
            `}
            onClick={() => handleSegmentClick(segment)}
          >
            <div className="flex items-start space-x-3">
              {viewMode.showTimestamps && (
                <div className="text-xs text-gray-500 font-mono min-w-[80px]">
                  {formatDuration(segment.startTime)}
                </div>
              )}
              
              {viewMode.showSpeakers && segment.speakerId && (
                <div className="text-xs text-blue-600 font-medium min-w-[80px]">
                  {segment.speakerId}
                </div>
              )}
              
              <div className="flex-1">
                {editingSegment === segment.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 border rounded resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditSave(segment.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                    
                    <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center space-x-2">
                        {viewMode.showConfidence && (
                          <span
                            className={`text-xs ${getConfidenceColor(
                              segment.confidence
                            )}`}
                          >
                            {Math.round(segment.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStart(segment);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {segments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No transcript available yet
        </div>
      )}
    </div>
  );
}