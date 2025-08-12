"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Clock,
  Award,
  Shield,
  Zap,
  HardDrive,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  Info,
  Calculator,
  BarChart3
} from 'lucide-react';

export interface TranscriptionMethod {
  id: string;
  name: string;
  provider: string;
  description: string;
  costPerMinute: number;
  avgProcessingTimeMultiplier: number; // Multiplier of file duration
  accuracyScore: number; // 0-100
  privacyLevel: 'low' | 'medium' | 'high';
  supportedLanguages: number;
  maxFileSize: number; // MB
  features: string[];
  limitations: string[];
  useCase: string;
  icon: React.ReactNode;
}

const transcriptionMethods: TranscriptionMethod[] = [
  {
    id: 'openai',
    name: 'OpenAI Whisper API',
    provider: 'OpenAI',
    description: 'Cloud-based transcription with state-of-the-art accuracy',
    costPerMinute: 0.006, // $0.006 per minute
    avgProcessingTimeMultiplier: 0.1, // 10% of file duration
    accuracyScore: 95,
    privacyLevel: 'low',
    supportedLanguages: 99,
    maxFileSize: 25, // 25MB
    features: [
      'Highest accuracy',
      'Fast processing',
      'Multiple languages',
      'Automatic language detection',
      'Word-level timestamps',
      'Speaker diarization'
    ],
    limitations: [
      'Requires internet',
      'Data sent to OpenAI',
      'Usage costs',
      'File size limits'
    ],
    useCase: 'Professional transcription with highest quality requirements',
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'browser',
    name: 'Browser Whisper',
    provider: 'Local (WebAssembly)',
    description: 'Client-side processing for complete privacy',
    costPerMinute: 0, // Free
    avgProcessingTimeMultiplier: 2.5, // 2.5x file duration
    accuracyScore: 85,
    privacyLevel: 'high',
    supportedLanguages: 99,
    maxFileSize: 500, // 500MB
    features: [
      'Complete privacy',
      'No internet required',
      'Unlimited usage',
      'Large file support',
      'Offline processing'
    ],
    limitations: [
      'Slower processing',
      'Requires model download',
      'CPU intensive',
      'Battery drain on mobile'
    ],
    useCase: 'Sensitive content requiring complete privacy',
    icon: <Shield className="w-4 h-4" />
  },
  {
    id: 'server',
    name: 'Server Whisper',
    provider: 'VoiceFlow Pro',
    description: 'Balanced performance with privacy controls',
    costPerMinute: 0.003, // $0.003 per minute
    avgProcessingTimeMultiplier: 0.5, // 50% of file duration
    accuracyScore: 90,
    privacyLevel: 'medium',
    supportedLanguages: 99,
    maxFileSize: 100, // 100MB
    features: [
      'Good accuracy',
      'Reasonable speed',
      'Privacy controls',
      'Cost effective',
      'Large file support'
    ],
    limitations: [
      'Requires internet',
      'Processing queue',
      'Usage limits'
    ],
    useCase: 'Balanced approach for regular transcription needs',
    icon: <Cpu className="w-4 h-4" />
  }
];

interface ComparisonCardProps {
  method: TranscriptionMethod;
  fileSize: number; // MB
  fileDuration: number; // minutes
  isSelected?: boolean;
  onSelect?: () => void;
}

function ComparisonCard({ method, fileSize, fileDuration, isSelected, onSelect }: ComparisonCardProps) {
  const estimatedCost = method.costPerMinute * fileDuration;
  const estimatedTime = fileDuration * method.avgProcessingTimeMultiplier;
  
  const getPrivacyColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const canProcessFile = fileSize <= method.maxFileSize;

  return (
    <Card className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:shadow-md'} ${!canProcessFile ? 'opacity-60' : ''}`} onClick={canProcessFile ? onSelect : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2">
            {method.icon}
            <div>
              <CardTitle className="text-lg">{method.name}</CardTitle>
              <p className="text-sm text-gray-600">{method.provider}</p>
            </div>
          </div>
          {isSelected && <Check className="w-5 h-5 text-green-600" />}
        </div>
        <p className="text-sm text-gray-700">{method.description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!canProcessFile && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <X className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs text-red-800">File too large (max {method.maxFileSize}MB)</p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-green-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-lg font-bold">
                {estimatedCost === 0 ? 'Free' : `$${estimatedCost.toFixed(3)}`}
              </span>
            </div>
            <p className="text-xs text-gray-500">Estimated cost</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-blue-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-bold">{formatTime(estimatedTime)}</span>
            </div>
            <p className="text-xs text-gray-500">Processing time</p>
          </div>
        </div>

        {/* Accuracy & Privacy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center space-x-1">
              <Award className="w-3 h-3" />
              <span>Accuracy</span>
            </span>
            <div className="flex items-center space-x-2">
              <Progress value={method.accuracyScore} className="w-16 h-2" />
              <span className="font-medium">{method.accuracyScore}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Privacy</span>
            </span>
            <Badge className={`text-xs ${getPrivacyColor(method.privacyLevel)}`}>
              {method.privacyLevel.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Use Case */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-700 italic">{method.useCase}</p>
        </div>

        {/* Features Preview */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-700">Key Features:</p>
          <div className="flex flex-wrap gap-1">
            {method.features.slice(0, 3).map((feature, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {feature}
              </Badge>
            ))}
            {method.features.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{method.features.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ComparisonTableProps {
  methods: TranscriptionMethod[];
  fileSize: number;
  fileDuration: number;
}

function ComparisonTable({ methods, fileSize, fileDuration }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2">Method</th>
            <th className="text-center py-3 px-2">Cost</th>
            <th className="text-center py-3 px-2">Time</th>
            <th className="text-center py-3 px-2">Accuracy</th>
            <th className="text-center py-3 px-2">Privacy</th>
            <th className="text-center py-3 px-2">Max Size</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => {
            const estimatedCost = method.costPerMinute * fileDuration;
            const estimatedTime = fileDuration * method.avgProcessingTimeMultiplier;
            const canProcess = fileSize <= method.maxFileSize;
            
            return (
              <tr key={method.id} className={`border-b ${!canProcess ? 'opacity-50' : ''}`}>
                <td className="py-3 px-2">
                  <div className="flex items-center space-x-2">
                    {method.icon}
                    <div>
                      <div className="font-medium">{method.name}</div>
                      <div className="text-xs text-gray-500">{method.provider}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="font-medium text-green-600">
                    {estimatedCost === 0 ? 'Free' : `$${estimatedCost.toFixed(3)}`}
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="font-medium text-blue-600">
                    {estimatedTime < 1 ? `${Math.round(estimatedTime * 60)}s` : `${Math.round(estimatedTime)}m`}
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <div className="flex items-center justify-center space-x-1">
                    <Progress value={method.accuracyScore} className="w-12 h-2" />
                    <span className="text-xs">{method.accuracyScore}%</span>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <Badge className={`text-xs ${method.privacyLevel === 'high' ? 'bg-green-100 text-green-800' : method.privacyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {method.privacyLevel.toUpperCase()}
                  </Badge>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={canProcess ? 'text-green-600' : 'text-red-600'}>
                    {method.maxFileSize}MB
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface CostQualityComparisonProps {
  fileSize?: number; // MB
  fileDuration?: number; // minutes
  onMethodSelect?: (methodId: string) => void;
  selectedMethod?: string;
  className?: string;
}

export function CostQualityComparison({
  fileSize = 10,
  fileDuration = 5,
  onMethodSelect,
  selectedMethod,
  className = ''
}: CostQualityComparisonProps) {
  const [view, setView] = useState<'cards' | 'table' | 'details'>('cards');

  const sortedMethods = useMemo(() => {
    return [...transcriptionMethods].sort((a, b) => {
      // Sort by accuracy first, then by cost
      if (b.accuracyScore !== a.accuracyScore) {
        return b.accuracyScore - a.accuracyScore;
      }
      return a.costPerMinute - b.costPerMinute;
    });
  }, []);

  const bestMethod = sortedMethods.find(m => fileSize <= m.maxFileSize);
  const cheapestMethod = transcriptionMethods.reduce((prev, curr) => 
    (curr.costPerMinute < prev.costPerMinute && fileSize <= curr.maxFileSize) ? curr : prev
  );
  const fastestMethod = transcriptionMethods.reduce((prev, curr) => 
    (curr.avgProcessingTimeMultiplier < prev.avgProcessingTimeMultiplier && fileSize <= curr.maxFileSize) ? curr : prev
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Method Comparison</span>
          </CardTitle>
          
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="cards" className="text-xs">Cards</TabsTrigger>
              <TabsTrigger value="table" className="text-xs">Table</TabsTrigger>
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* File Info */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <HardDrive className="w-3 h-3" />
            <span>{fileSize}MB file</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{fileDuration} minutes</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calculator className="w-3 h-3" />
            <span>Estimates based on file properties</span>
          </div>
        </div>

        {/* Quick Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {bestMethod && (
            <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <div className="flex items-center space-x-1">
                <Award className="w-3 h-3 text-blue-600" />
                <span className="font-medium text-blue-800">Best Quality:</span>
              </div>
              <span className="text-blue-700">{bestMethod.name}</span>
            </div>
          )}
          
          <div className="bg-green-50 border border-green-200 rounded px-2 py-1">
            <div className="flex items-center space-x-1">
              <DollarSign className="w-3 h-3 text-green-600" />
              <span className="font-medium text-green-800">Most Affordable:</span>
            </div>
            <span className="text-green-700">{cheapestMethod.name}</span>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3 text-orange-600" />
              <span className="font-medium text-orange-800">Fastest:</span>
            </div>
            <span className="text-orange-700">{fastestMethod.name}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <TabsContent value="cards" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedMethods.map((method) => (
              <ComparisonCard
                key={method.id}
                method={method}
                fileSize={fileSize}
                fileDuration={fileDuration}
                isSelected={selectedMethod === method.id}
                onSelect={() => onMethodSelect?.(method.id)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <ComparisonTable
            methods={sortedMethods}
            fileSize={fileSize}
            fileDuration={fileDuration}
          />
        </TabsContent>

        <TabsContent value="details" className="mt-0">
          <div className="space-y-6">
            {sortedMethods.map((method) => {
              const estimatedCost = method.costPerMinute * fileDuration;
              const estimatedTime = fileDuration * method.avgProcessingTimeMultiplier;
              const canProcess = fileSize <= method.maxFileSize;

              return (
                <Card key={method.id} className={!canProcess ? 'opacity-50' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        {method.icon}
                        <div>
                          <CardTitle className="text-base">{method.name}</CardTitle>
                          <p className="text-sm text-gray-600">{method.provider}</p>
                        </div>
                      </div>
                      {selectedMethod === method.id && <Check className="w-5 h-5 text-green-600" />}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">{method.description}</p>
                    
                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-green-600">
                          {estimatedCost === 0 ? 'Free' : `$${estimatedCost.toFixed(3)}`}
                        </div>
                        <p className="text-xs text-gray-500">Cost</p>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600">
                          {estimatedTime < 1 ? `${Math.round(estimatedTime * 60)}s` : `${Math.round(estimatedTime)}m`}
                        </div>
                        <p className="text-xs text-gray-500">Time</p>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">{method.accuracyScore}%</div>
                        <p className="text-xs text-gray-500">Accuracy</p>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{method.supportedLanguages}</div>
                        <p className="text-xs text-gray-500">Languages</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Features & Limitations */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2 text-green-700">Features</h4>
                        <ul className="space-y-1">
                          {method.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center space-x-2 text-xs">
                              <Check className="w-3 h-3 text-green-600" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2 text-red-700">Limitations</h4>
                        <ul className="space-y-1">
                          {method.limitations.map((limitation, idx) => (
                            <li key={idx} className="flex items-center space-x-2 text-xs">
                              <X className="w-3 h-3 text-red-600" />
                              <span>{limitation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {canProcess && onMethodSelect && (
                      <Button
                        onClick={() => onMethodSelect(method.id)}
                        variant={selectedMethod === method.id ? "default" : "outline"}
                        className="w-full"
                        size="sm"
                      >
                        {selectedMethod === method.id ? 'Selected' : 'Select Method'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </CardContent>
    </Card>
  );
}