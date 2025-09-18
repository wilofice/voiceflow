import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// import heroImage from '@/assets/hero-image.jpg';
import { 
  Upload,
  Mic,
  Zap,
  MonitorSpeaker,
  Cloud,
  FileAudio,
  Clock,
  Play,
  MoreHorizontal,
  Star,
  Download,
  Link2,
  Folder,
  Settings2,
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  shortcut: string;
  badge?: string;
  onClick?: () => void;
}

interface TranscriptItem {
  id: string;
  title: string;
  duration: string;
  timestamp: string;
  status: 'completed' | 'processing' | 'error' | 'queued';
  confidence?: number;
  starred?: boolean;
}

interface DashboardProps {
  className?: string;
  onUrlSubmit?: (url: string) => void;
  onQuickAction?: (action: QuickAction) => void;
  onTranscriptSelect?: (transcript: TranscriptItem) => void;
}

const quickActions: QuickAction[] = [
  {
    id: 'upload',
    title: 'Open Files',
    description: 'Drag & drop or browse files',
    icon: Upload,
    shortcut: 'Cmd+O',
  },
  {
    id: 'record',
    title: 'New Recording',
    description: 'Start microphone recording',
    icon: Mic,
    shortcut: 'Cmd+R',
    badge: 'Live',
  },
  {
    id: 'batch',
    title: 'Batch Process',
    description: 'Queue multiple files',
    icon: Zap,
    shortcut: 'Cmd+B',
    badge: 'Pro',
  },
  {
    id: 'system-audio',
    title: 'Record App Audio',
    description: 'Capture system sound',
    icon: MonitorSpeaker,
    shortcut: 'Cmd+Shift+R',
    badge: 'Beta',
  },
  {
    id: 'cloud',
    title: 'Cloud Transcription',
    description: 'Use cloud processing',
    icon: Cloud,
    shortcut: 'Cmd+Shift+C',
    badge: 'Pro',
  },
  {
    id: 'watch-folder',
    title: 'Watch Folder',
    description: 'Auto-process new files',
    icon: Folder,
    shortcut: 'Cmd+W',
  },
];

const mockTranscripts: TranscriptItem[] = [
  {
    id: '1',
    title: 'Team Standup Meeting - March 15th',
    duration: '23:45',
    timestamp: '2 hours ago',
    status: 'completed',
    confidence: 96,
    starred: true,
  },
  {
    id: '2',
    title: 'Customer Interview Session #47',
    duration: '45:22',
    timestamp: '4 hours ago',
    status: 'completed',
    confidence: 94,
  },
  {
    id: '3',
    title: 'Podcast Episode - Future of AI',
    duration: '1:12:33',
    timestamp: '1 day ago',
    status: 'processing',
  },
  {
    id: '4',
    title: 'Research Call with Dr. Sarah Kim',
    duration: '37:18',
    timestamp: '2 days ago',
    status: 'completed',
    confidence: 98,
    starred: true,
  },
  {
    id: '5',
    title: 'Product Strategy Brainstorm',
    duration: '56:09',
    timestamp: '3 days ago',
    status: 'error',
  },
];

export const Dashboard: React.FC<DashboardProps> = ({
  className,
  onUrlSubmit,
  onQuickAction,
  onTranscriptSelect,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onUrlSubmit?.(urlInput.trim());
      setUrlInput('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Handle file drop
    const files = Array.from(e.dataTransfer.files);
    console.log('Dropped files:', files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const getStatusColor = (status: TranscriptItem['status']) => {
    switch (status) {
      case 'completed': return 'text-success';
      case 'processing': return 'text-primary';
      case 'error': return 'text-danger';
      case 'queued': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  const getStatusBadge = (status: TranscriptItem['status']) => {
    switch (status) {
      case 'completed': return <Badge variant="outline" className="text-success border-success">Complete</Badge>;
      case 'processing': return <Badge variant="outline" className="text-primary border-primary animate-pulse">Processing</Badge>;
      case 'error': return <Badge variant="outline" className="text-danger border-danger">Error</Badge>;
      case 'queued': return <Badge variant="outline" className="text-warning border-warning">Queued</Badge>;
      default: return null;
    }
  };

  return (
    <div className={cn("min-h-full bg-background", className)}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="h-80 bg-cover bg-center bg-no-repeat"
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          <div className="relative h-full flex items-center px-8">
            <div className="max-w-2xl">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl font-bold text-text-primary mb-4"
              >
                Transform Audio into Intelligence
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-text-secondary mb-8"
              >
                Professional-grade transcription with AI-powered summaries, 
                speaker identification, and batch processing.
              </motion.p>
              
              {/* URL Input */}
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                onSubmit={handleUrlSubmit}
                className="flex gap-3 max-w-md"
              >
                <Input
                  type="url"
                  placeholder="Paste YouTube, Vimeo, or audio URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="bg-surface-alt/80 backdrop-blur-sm border-border focus-ring"
                />
                <Button 
                  type="submit"
                  className="bg-gradient-primary hover:opacity-90 focus-ring"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Transcribe
                </Button>
              </motion.form>
            </div>
          </div>
        </div>
      </section>

      <div className="px-8 py-8 space-y-8">
        {/* Drag & Drop Zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card 
            className={cn(
              "border-2 border-dashed transition-all duration-200 cursor-pointer hover:border-primary/50",
              isDragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-border"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="drop-zone"
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className="w-12 h-12 text-text-secondary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Drop audio or video files here
              </h3>
              <p className="text-text-secondary mb-4 text-center">
                Supports MP3, WAV, M4A, MP4, MOV, AIFF, CAF, OGG
              </p>
              <Button variant="outline" className="focus-ring">
                Browse Files
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-2xl font-bold text-text-primary mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card 
                    className="hover:bg-surface-alt/50 transition-all duration-200 cursor-pointer hover:scale-[1.02] group focus-ring"
                    onClick={() => onQuickAction?.(action)}
                    data-testid={`quick-action-${action.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="w-6 h-6 text-primary" />
                        {action.badge && (
                          <Badge 
                            variant={action.badge === 'Pro' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {action.badge}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <span className="kbd">{action.shortcut}</span>
                        <motion.div
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          whileHover={{ x: 2 }}
                        >
                          →
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Recent Transcripts */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Recent Transcripts</h2>
            <Button variant="outline" className="focus-ring">
              <Settings2 className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {mockTranscripts.map((transcript, index) => (
              <motion.div
                key={transcript.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card 
                  className="hover:bg-surface-alt/30 transition-all duration-200 cursor-pointer group focus-ring"
                  onClick={() => onTranscriptSelect?.(transcript)}
                  data-testid={`transcript-${transcript.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                          <FileAudio className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text-primary truncate">
                              {transcript.title}
                            </h3>
                            {transcript.starred && (
                              <Star className="w-4 h-4 text-warning fill-current flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{transcript.duration}</span>
                            </div>
                            <span>{transcript.timestamp}</span>
                            {transcript.confidence && (
                              <span>Confidence: {transcript.confidence}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(transcript.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 focus-ring"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 focus-ring"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;