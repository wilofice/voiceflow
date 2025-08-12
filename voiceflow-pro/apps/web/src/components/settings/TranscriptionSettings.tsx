'use client';

import { useState, useEffect } from 'react';
import { TranscriptionMethod } from '@/lib/whisper/transcriptionRouter';
import { WhisperModel } from '@/lib/whisper/modelManager';
import { TranscriptionMethodSelector } from '@/components/transcription/TranscriptionMethodSelector';
import { ModelManager } from '@/components/whisper/ModelManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Shield,
  Zap,
  DollarSign,
  Download,
  Globe,
  Volume2,
  Mic,
  Save,
  RotateCcw,
  Info
} from 'lucide-react';

interface TranscriptionPreferences {
  defaultMethod: TranscriptionMethod;
  defaultWhisperModel: WhisperModel;
  fallbackEnabled: boolean;
  privacyMode: boolean;
  autoDownloadModels: boolean;
  realtimeTranscription: boolean;
  language: string;
  audioQuality: 'low' | 'medium' | 'high';
  maxFileSize: number;
  batchProcessing: boolean;
}

const DEFAULT_PREFERENCES: TranscriptionPreferences = {
  defaultMethod: 'whisper-browser',
  defaultWhisperModel: 'base',
  fallbackEnabled: true,
  privacyMode: false,
  autoDownloadModels: false,
  realtimeTranscription: true,
  language: 'auto',
  audioQuality: 'high',
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
  batchProcessing: true,
};

export interface TranscriptionSettingsProps {
  onPreferencesChange?: (preferences: TranscriptionPreferences) => void;
  className?: string;
}

export function TranscriptionSettings({ 
  onPreferencesChange, 
  className = '' 
}: TranscriptionSettingsProps) {
  const [preferences, setPreferences] = useState<TranscriptionPreferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('whisper-transcription-preferences');
      if (saved) {
        const parsedPrefs = JSON.parse(saved);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsedPrefs });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }, []);

  const updatePreferences = (updates: Partial<TranscriptionPreferences>) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, ...updates };
      setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(DEFAULT_PREFERENCES));
      return newPrefs;
    });
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      localStorage.setItem('whisper-transcription-preferences', JSON.stringify(preferences));
      onPreferencesChange?.(preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setPreferences(DEFAULT_PREFERENCES);
      setHasChanges(true);
    }
  };

  const getCostEstimate = (method: TranscriptionMethod) => {
    if (method === 'openai') return '$0.36/hour';
    if (method === 'whisper-browser') return 'Free*';
    if (method === 'whisper-server') return '~$0.05/hour**';
    return 'Unknown';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Settings className="w-6 h-6" />
            <span>Transcription Settings</span>
          </h2>
          <p className="text-gray-600">
            Configure your transcription preferences and manage Whisper models
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Badge variant="secondary">Unsaved Changes</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <Button
            onClick={savePreferences}
            disabled={!hasChanges || saving}
            size="sm"
            className="text-xs"
          >
            <Save className="w-3 h-3 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="methods" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        {/* Transcription Methods Tab */}
        <TabsContent value="methods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Default Transcription Method</CardTitle>
              <CardDescription>
                Choose your preferred transcription method. This will be used by default for new uploads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptionMethodSelector
                currentMethod={preferences.defaultMethod}
                currentModel={preferences.defaultWhisperModel}
                onMethodChange={(method, model) => {
                  updatePreferences({
                    defaultMethod: method,
                    ...(model && { defaultWhisperModel: model }),
                  });
                }}
                showComparison={false}
                className="mb-4"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advanced Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Fallback</Label>
                  <p className="text-xs text-gray-500">
                    Automatically try other methods if the primary method fails
                  </p>
                </div>
                <Switch
                  checked={preferences.fallbackEnabled}
                  onCheckedChange={(checked) => 
                    updatePreferences({ fallbackEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Batch Processing</Label>
                  <p className="text-xs text-gray-500">
                    Process multiple files simultaneously for efficiency
                  </p>
                </div>
                <Switch
                  checked={preferences.batchProcessing}
                  onCheckedChange={(checked) => 
                    updatePreferences({ batchProcessing: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Max File Size</Label>
                <Select
                  value={preferences.maxFileSize.toString()}
                  onValueChange={(value) =>
                    updatePreferences({ maxFileSize: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={(500 * 1024 * 1024).toString()}>500 MB</SelectItem>
                    <SelectItem value={(1024 * 1024 * 1024).toString()}>1 GB</SelectItem>
                    <SelectItem value={(2 * 1024 * 1024 * 1024).toString()}>2 GB</SelectItem>
                    <SelectItem value={(5 * 1024 * 1024 * 1024).toString()}>5 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cost Estimates */}
          <Card className="bg-green-50">
            <CardHeader>
              <CardTitle className="text-base text-green-900 flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Cost Estimates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-medium text-green-700">OpenAI API</div>
                  <div className="text-green-600">{getCostEstimate('openai')}</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-green-700">Whisper Browser</div>
                  <div className="text-green-600">{getCostEstimate('whisper-browser')}</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-green-700">Whisper Server</div>
                  <div className="text-green-600">{getCostEstimate('whisper-server')}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-green-700">
                <p>* Free after initial model download</p>
                <p>** Estimated infrastructure costs</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Auto-Download Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Download Recommended Models</Label>
                  <p className="text-xs text-gray-500">
                    Automatically download models that work well on your device
                  </p>
                </div>
                <Switch
                  checked={preferences.autoDownloadModels}
                  onCheckedChange={(checked) => 
                    updatePreferences({ autoDownloadModels: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <ModelManager 
            onModelChange={(modelId, downloaded) => {
              console.log(`Model ${modelId} ${downloaded ? 'downloaded' : 'deleted'}`);
            }}
          />
        </TabsContent>

        {/* Audio Settings Tab */}
        <TabsContent value="audio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Volume2 className="w-5 h-5" />
                <span>Audio Processing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select
                  value={preferences.language}
                  onValueChange={(value) => updatePreferences({ language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-Detect</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audio Quality Preference</Label>
                <Select
                  value={preferences.audioQuality}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    updatePreferences({ audioQuality: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Faster processing)</SelectItem>
                    <SelectItem value="medium">Medium (Balanced)</SelectItem>
                    <SelectItem value="high">High (Better accuracy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>Real-time Transcription</span>
                  </Label>
                  <p className="text-xs text-gray-500">
                    Enable live transcription from microphone input
                  </p>
                </div>
                <Switch
                  checked={preferences.realtimeTranscription}
                  onCheckedChange={(checked) => 
                    updatePreferences({ realtimeTranscription: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Privacy Mode</Label>
                  <p className="text-xs text-gray-500">
                    Prioritize local processing over cloud services for sensitive content
                  </p>
                </div>
                <Switch
                  checked={preferences.privacyMode}
                  onCheckedChange={(checked) => 
                    updatePreferences({ privacyMode: checked })
                  }
                />
              </div>

              {preferences.privacyMode && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Privacy mode enabled. Whisper browser models will be preferred over cloud services.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">Data Processing Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>OpenAI API:</span>
                  <Badge variant="secondary">Cloud (OpenAI Servers)</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Whisper Browser:</span>
                  <Badge variant="default">Local (Your Device)</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Whisper Server:</span>
                  <Badge variant="outline">Local (Your Infrastructure)</Badge>
                </div>
              </div>
              <div className="mt-3 text-xs text-blue-700">
                <p>Local processing keeps your data private and secure.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}