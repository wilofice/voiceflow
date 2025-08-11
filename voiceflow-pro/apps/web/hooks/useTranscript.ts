'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Transcript, TranscriptSegment, TranscriptStatus } from '@voiceflow-pro/shared';

interface UseTranscriptOptions {
  pollingInterval?: number;
}

export function useTranscript(
  transcriptId: string | null,
  options: UseTranscriptOptions = {}
) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { pollingInterval = 2000 } = options;
  const supabase = createClient();

  useEffect(() => {
    if (!transcriptId) return;

    let intervalId: NodeJS.Timeout;

    const fetchTranscript = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/transcripts/${transcriptId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transcript');
        }

        const data = await response.json();
        setTranscript(data.transcript);
        setSegments(data.transcript.segments || []);

        // Stop polling if transcript is completed or failed
        if (data.transcript.status === 'COMPLETED' || data.transcript.status === 'FAILED') {
          clearInterval(intervalId);
        }
      } catch (err: any) {
        setError(err.message);
        clearInterval(intervalId);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchTranscript();

    // Set up polling for status updates
    if (transcript?.status === 'QUEUED' || transcript?.status === 'PROCESSING') {
      intervalId = setInterval(fetchTranscript, pollingInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [transcriptId, pollingInterval, supabase]);

  const retryTranscription = async () => {
    if (!transcriptId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/transcripts/${transcriptId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to retry transcription');
      }

      // Refetch transcript
      setTranscript(prev => prev ? { ...prev, status: 'QUEUED' as TranscriptStatus } : null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return {
    transcript,
    segments,
    loading,
    error,
    retryTranscription,
  };
}