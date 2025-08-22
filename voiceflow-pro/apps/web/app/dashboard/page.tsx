'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatDate, formatDuration } from '@/lib/utils';

interface Transcript {
  id: string;
  title: string;
  status: string;
  duration: number;
  language: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/transcripts?limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTranscripts(data.transcripts || []);
        
        // Calculate stats
        const completed = (data.transcripts || []).filter((t: Transcript) => t.status === 'COMPLETED');
        const totalDuration = completed.reduce((sum: number, t: Transcript) => sum + t.duration, 0);
        
        setStats({
          total: data.transcripts?.length || 0,
          completed: completed.length,
          totalDuration,
        });
      }
    } catch (error) {
      console.error('Failed to fetch transcripts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      QUEUED: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <ProtectedRoute>
      <Layout user={user ? { name: user.user_metadata?.name || 'User', email: user.email! } : null}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Transcripts</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hours Transcribed</h3>
              <p className="text-3xl font-bold text-green-600">{(stats.totalDuration / 3600).toFixed(1)}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Completed</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.completed}</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Recent Transcripts</h2>
              <Link
                href="/whisper-demo"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Audio
              </Link>
            </div>
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : transcripts.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No transcripts yet. Upload an audio file to get started!</p>
                  <Link
                    href="/whisper-demo"
                    className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Whisper Demo
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {transcripts.map((transcript) => (
                    <div key={transcript.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Link
                            href={`/transcripts/${transcript.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-blue-600"
                          >
                            {transcript.title}
                          </Link>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatDate(transcript.createdAt)}</span>
                            {transcript.duration > 0 && (
                              <span>{formatDuration(transcript.duration)}</span>
                            )}
                            <span>{transcript.language.toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {getStatusBadge(transcript.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}