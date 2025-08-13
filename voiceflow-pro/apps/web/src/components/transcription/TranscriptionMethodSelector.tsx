'use client';

import { useState, useEffect } from 'react';
import { TranscriptionMethod } from '@/lib/whisper/transcriptionRouter';
import { WhisperModel } from '@/lib/whisper/modelManager';
import { checkBrowserCompatibility } from '@/lib/whisper/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Cloud, 
  Cpu, 
  Shield, 
  Zap, 
  DollarSign, 
  Gauge,
  Clock,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

export interface TranscriptionMethodSelectorProps {
  currentMethod: TranscriptionMethod;
  currentModel?: WhisperModel;
  onMethodChange: (method: TranscriptionMethod, model?: WhisperModel) => void;
  disabled?: boolean;
  showComparison?: boolean;
  className?: string;
}

interface MethodInfo {
  id: TranscriptionMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  pros: string[];
  cons: string[];
  cost: 'Free*' | 'Low' | 'Medium' | 'High';
  speed: 'Fast' | 'Very Fast' | 'Ultra Fast';
  accuracy: 'Good' | 'Very Good' | 'Excellent';
  privacy: 'Local' | 'Cloud';
  offline: boolean;
  badge?: string;
  availability?: 'available' | 'requires-setup' | 'unavailable';
}

const METHOD_INFO: Record<TranscriptionMethod, MethodInfo> = {
  'openai': {
    id: 'openai',
    name: 'OpenAI Whisper API',
    description: 'Cloud-based transcription using OpenAI\'s premium Whisper models',
    icon: <Cloud className="w-5 h-5" />,
    pros: [
      'Highest accuracy available',
      'No setup required',
      'Always up-to-date models',
      'Supports 90+ languages',
      'Handles any audio quality'
    ],
    cons: [
      'Costs $0.006 per minute',
      'Requires internet connection',
      'Data sent to OpenAI servers',
      'Subject to API rate limits'
    ],
    cost: 'Medium',
    speed: 'Fast',
    accuracy: 'Excellent',
    privacy: 'Cloud',
    offline: false,
    badge: 'Premium'
  },
  'whisper-browser': {
    id: 'whisper-browser',
    name: 'Whisper (Browser)',
    description: 'Run Whisper models directly in your browser for privacy and speed',
    icon: <Cpu className="w-5 h-5" />,
    pros: [
      'Completely private (no data sent)',
      'Works offline',
      'Real-time transcription',
      'No per-minute costs',
      'Instant processing'
    ],
    cons: [
      'Requires model download',
      'Uses device resources',
      'Accuracy depends on model size',
      'Limited by device capabilities'
    ],
    cost: 'Free*',
    speed: 'Ultra Fast',
    accuracy: 'Good',
    privacy: 'Local',
    offline: true,
    badge: 'Privacy First'
  },
  'whisper-server': {
    id: 'whisper-server',
    name: 'Whisper (Server)',
    description: 'Server-side Whisper processing for larger files and better accuracy',
    icon: <Gauge className="w-5 h-5" />,
    pros: [
      'High accuracy with large models',
      'Handles large files efficiently',
      'No device limitations',
      'Batch processing support'
    ],
    cons: [
      'Requires server setup',
      'Higher infrastructure costs',
      'Network dependency',
      'Processing queue delays'
    ],
    cost: 'Low',
    speed: 'Very Fast',
    accuracy: 'Very Good',
    privacy: 'Local',
    offline: false,
    availability: 'requires-setup'
  }
};

export function TranscriptionMethodSelector({
  currentMethod,
  currentModel,
  onMethodChange,
  disabled = false,
  showComparison = true,
  className = ''
}: TranscriptionMethodSelectorProps) {
  const [browserCompatibility, setBrowserCompatibility] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<WhisperModel>(currentModel || 'base');

  useEffect(() => {
    const compatibility = checkBrowserCompatibility();
    setBrowserCompatibility(compatibility);
  }, []);

  const handleMethodSelect = (method: TranscriptionMethod) => {
    const model = method === 'whisper-browser' || method === 'whisper-server' ? selectedModel : undefined;
    onMethodChange(method, model);
  };

  const getMethodAvailability = (method: TranscriptionMethod): 'available' | 'requires-setup' | 'unavailable' => {
    if (method === 'whisper-browser' && browserCompatibility && !browserCompatibility.compatible) {
      return 'unavailable';
    }
    if (method === 'whisper-server') {
      return 'requires-setup'; // Would check server availability in real implementation
    }
    return 'available';
  };

  const renderMethodCard = (method: TranscriptionMethod) => {
    const info = METHOD_INFO[method];
    const availability = getMethodAvailability(method);
    const isSelected = currentMethod === method;
    const isDisabled = disabled || availability === 'unavailable';

    return (
      <Card 
        key={method}
        className={`cursor-pointer transition-all hover:shadow-lg ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        onClick={() => !isDisabled && handleMethodSelect(method)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-2 min-w-0">
              {info.icon}
              <div className="min-w-0">
                <CardTitle className="text-base leading-tight">{info.name}</CardTitle>
                <CardDescription className="text-xs text-gray-500 line-clamp-2 mt-1">
                  {info.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
              {info.badge && (
                <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                  {info.badge}
                </Badge>
              )}
              {isSelected && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Status Alert */}
          {availability === 'unavailable' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Not supported in your browser. Missing: {browserCompatibility?.missing?.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {availability === 'requires-setup' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Requires server configuration. Contact administrator.
              </AlertDescription>
            </Alert>
          )}

          {/* Metrics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
                <DollarSign className="w-3 h-3 flex-shrink-0" />
                <span>Cost</span>
              </div>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {info.cost}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
                <Zap className="w-3 h-3 flex-shrink-0" />
                <span>Speed</span>
              </div>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {info.speed}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
                <Gauge className="w-3 h-3 flex-shrink-0" />
                <span>Accuracy</span>
              </div>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {info.accuracy}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
                <Shield className="w-3 h-3 flex-shrink-0" />
                <span>Privacy</span>
              </div>
              <Badge 
                variant={info.privacy === 'Local' ? 'default' : 'secondary'} 
                className="text-xs whitespace-nowrap"
              >
                {info.privacy}
              </Badge>
            </div>
          </div>

          {/* Model Selection for Whisper methods */}
          {(method === 'whisper-browser' || method === 'whisper-server') && isSelected && (
            <div className="pt-4 border-t">
              <label className="text-sm font-medium mb-2 block">
                Model Selection
              </label>
              <Select 
                value={selectedModel} 
                onValueChange={(value: WhisperModel) => {
                  setSelectedModel(value);
                  onMethodChange(method, value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiny">Tiny (39MB) - Fastest, ~85% accuracy</SelectItem>
                  <SelectItem value="base">Base (142MB) - Balanced, ~91% accuracy</SelectItem>
                  <SelectItem value="small">Small (466MB) - Good, ~94% accuracy</SelectItem>
                  <SelectItem value="medium">Medium (1.5GB) - High, ~96% accuracy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pros and Cons */}
          {showComparison && isSelected && (
            <div className="pt-4 border-t space-y-3">
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2">Advantages</h4>
                <ul className="text-xs space-y-1">
                  {info.pros.map((pro, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-orange-700 mb-2">Considerations</h4>
                <ul className="text-xs space-y-1">
                  {info.cons.map((con, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertCircle className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Choose Transcription Method</h3>
        <p className="text-xs text-gray-600">
          Select how you'd like your audio to be transcribed. Each method has different trade-offs.
        </p>
      </div>

      {/* Browser Compatibility Warning */}
      {browserCompatibility && !browserCompatibility.compatible && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Browser Limitation:</strong> Your browser doesn't support all Whisper features. 
            Missing: {browserCompatibility.missing.join(', ')}. 
            Consider using a modern browser like Chrome, Firefox, or Edge.
          </AlertDescription>
        </Alert>
      )}

      {/* Method Cards */}
      <div className="grid gap-3">
        {(Object.keys(METHOD_INFO) as TranscriptionMethod[]).map(renderMethodCard)}
      </div>

      {/* Quick Recommendations */}
      <div className="bg-blue-50 rounded-lg p-3">
        <h4 className="font-medium mb-2 flex items-center space-x-2 text-sm">
          <Info className="w-4 h-4" />
          <span>Quick Recommendations</span>
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-start space-x-2">
            <span className="font-medium text-blue-700 whitespace-nowrap">Privacy:</span>
            <span className="text-gray-600">Choose Whisper (Browser) to keep all data local</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium text-blue-700 whitespace-nowrap">Accuracy:</span>
            <span className="text-gray-600">Choose OpenAI API for best results</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium text-blue-700 whitespace-nowrap">Cost:</span>
            <span className="text-gray-600">Choose Whisper (Browser) for free transcription</span>
          </div>
        </div>
      </div>

      {/* Cost Calculator Note */}
      <div className="text-xs text-gray-500">
        <p>
          * Free after initial model download. OpenAI API costs $0.006 per minute (~$0.36 per hour).
          See our <Button variant="link" className="p-0 h-auto text-xs">cost calculator</Button> for detailed estimates.
        </p>
      </div>
    </div>
  );
}