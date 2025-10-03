import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  Cloud,
  HardDrive,
  Settings,
  Plus,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Target,
  Zap
} from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Separator } from './separator';
import { Switch } from './switch';
import { Textarea } from './textarea';
import { toast } from './use-toast';

export interface WatchFolder {
  id: string;
  projectId: string;
  name: string;
  path: string;
  provider: 'local' | 'dropbox' | 'google_drive' | 'onedrive' | 'icloud_drive';
  isRecursive: boolean;
  status: 'active' | 'paused' | 'error';
  rules: {
    autoTranscribe: boolean;
    modelPresetId?: string;
    language?: string;
    exportPresetIds: string[];
    postProcessRecipeIds: string[];
    renameTemplate?: string;
    priority: 'low' | 'normal' | 'high';
    schedule?: string;
    conflictStrategy: 'skip' | 'overwrite' | 'version';
  };
  excludedPatterns: string[];
  lastScanAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WatchFolderConfigProps {
  watchFolders: WatchFolder[];
  integrationConnections: Array<{
    id: string;
    provider: string;
    status: string;
    metadata: { accountName?: string };
  }>;
  onCreateFolder: (folder: Partial<WatchFolder>) => void;
  onUpdateFolder: (id: string, updates: Partial<WatchFolder>) => void;
  onDeleteFolder: (id: string) => void;
  onToggleFolder: (id: string, active: boolean) => void;
}

const watchFolderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required'),
  provider: z.enum(['local', 'dropbox', 'google_drive', 'onedrive', 'icloud_drive']),
  isRecursive: z.boolean().default(true),
  autoTranscribe: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  conflictStrategy: z.enum(['skip', 'overwrite', 'version']).default('version'),
  excludedPatterns: z.string().optional(),
  schedule: z.string().optional(),
});

type WatchFolderFormData = z.infer<typeof watchFolderSchema>;

const providerConfig = {
  local: {
    name: 'Local Storage',
    icon: HardDrive,
    color: 'bg-gray-600',
    description: 'Monitor local folders'
  },
  dropbox: {
    name: 'Dropbox',
    icon: Cloud,
    color: 'bg-blue-600',
    description: 'Monitor Dropbox folders'
  },
  google_drive: {
    name: 'Google Drive',
    icon: Cloud,
    color: 'bg-blue-500',
    description: 'Monitor Google Drive folders'
  },
  onedrive: {
    name: 'OneDrive',
    icon: Cloud,
    color: 'bg-blue-700',
    description: 'Monitor OneDrive folders'
  },
  icloud_drive: {
    name: 'iCloud Drive',
    icon: Cloud,
    color: 'bg-gray-700',
    description: 'Monitor iCloud Drive folders'
  }
};

const FolderCard: React.FC<{
  folder: WatchFolder;
  onUpdate: (id: string, updates: Partial<WatchFolder>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}> = ({ folder, onUpdate, onDelete, onToggle }) => {
  const config = providerConfig[folder.provider];
  const IconComponent = config.icon;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'paused': return 'bg-warning text-warning-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'paused': return Pause;
      case 'error': return AlertCircle;
      default: return Clock;
    }
  };

  const StatusIcon = getStatusIcon(folder.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color} text-white`}>
              <IconComponent size={16} />
            </div>
            <div>
              <CardTitle className="text-sm">{folder.name}</CardTitle>
              <CardDescription className="text-xs font-mono">
                {folder.path}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(folder.status)}>
              <StatusIcon size={12} className="mr-1" />
              {folder.status}
            </Badge>
            <Switch
              checked={folder.status === 'active'}
              onCheckedChange={(checked) => onToggle(folder.id, checked)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border-border">
                <DropdownMenuItem onClick={() => {}}>
                  <Settings size={14} className="mr-2" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Target size={14} className="mr-2" />
                  Test Connection
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(folder.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Rules:</span>
            <div className="mt-1 space-y-1">
              {folder.rules.autoTranscribe && (
                <div className="flex items-center gap-1">
                  <Zap size={10} />
                  Auto-transcribe
                </div>
              )}
              <div className="flex items-center gap-1">
                <Filter size={10} />
                Priority: {folder.rules.priority}
              </div>
            </div>
          </div>
          <div>
            <span className="font-medium">Monitoring:</span>
            <div className="mt-1 space-y-1">
              <div>{folder.isRecursive ? 'Recursive' : 'Single level'}</div>
              {folder.lastScanAt && (
                <div>Last scan: {new Date(folder.lastScanAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CreateFolderDialog: React.FC<{
  integrationConnections: Array<{
    id: string;
    provider: string;
    status: string;
    metadata: { accountName?: string };
  }>;
  onCreateFolder: (folder: Partial<WatchFolder>) => void;
}> = ({ integrationConnections, onCreateFolder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'provider' | 'config'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  const form = useForm<WatchFolderFormData>({
    resolver: zodResolver(watchFolderSchema),
    defaultValues: {
      isRecursive: true,
      autoTranscribe: true,
      priority: 'normal',
      conflictStrategy: 'version'
    }
  });

  const cloudConnections = integrationConnections.filter(conn => 
    ['dropbox', 'google_drive', 'onedrive'].includes(conn.provider) && 
    conn.status === 'connected'
  );

  const availableProviders = [
    { id: 'local', ...providerConfig.local, available: true },
    ...cloudConnections.map(conn => ({
      id: conn.provider,
      ...providerConfig[conn.provider as keyof typeof providerConfig],
      available: true,
      accountName: conn.metadata.accountName
    }))
  ];

  const onSubmit = (data: WatchFolderFormData) => {
    const excludedPatterns = data.excludedPatterns 
      ? data.excludedPatterns.split('\n').filter(p => p.trim())
      : [];

    onCreateFolder({
      name: data.name,
      path: data.path,
      provider: data.provider,
      isRecursive: data.isRecursive,
      rules: {
        autoTranscribe: data.autoTranscribe,
        priority: data.priority,
        conflictStrategy: data.conflictStrategy,
        exportPresetIds: [],
        postProcessRecipeIds: []
      },
      excludedPatterns,
      status: 'active'
    });

    setIsOpen(false);
    setStep('provider');
    form.reset();
    toast({
      title: "Watch Folder Created",
      description: `Now monitoring ${data.name} for new audio files.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} className="mr-2" />
          Add Watch Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Watch Folder</DialogTitle>
          <DialogDescription>
            Set up automatic monitoring of folders for new audio files.
          </DialogDescription>
        </DialogHeader>

        {step === 'provider' && (
          <div className="space-y-4">
            <h4 className="font-medium">Choose Storage Provider</h4>
            <div className="grid grid-cols-1 gap-3">
              {availableProviders.map((provider) => {
                const IconComponent = provider.icon;
                return (
                  <Card 
                    key={provider.id}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedProvider === provider.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      form.setValue('provider', provider.id as any);
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${provider.color} text-white`}>
                          <IconComponent size={20} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm">{provider.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {provider.description}
                            {'accountName' in provider && provider.accountName && (
                              <span className="block text-primary">
                                Connected: {provider.accountName}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={() => setStep('config')}
                disabled={!selectedProvider}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'config' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Folder Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Documents" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Folder Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/Audio/Recordings" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Monitoring Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isRecursive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Monitor Subfolders</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoTranscribe"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Auto-transcribe</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Processing Rules</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="conflictStrategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conflict Strategy</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="skip">Skip existing</SelectItem>
                            <SelectItem value="overwrite">Overwrite</SelectItem>
                            <SelectItem value="version">Create version</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="excludedPatterns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exclude Patterns (one per line)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="*.tmp&#10;*_backup*&#10;.DS_Store"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep('provider')}>
                  Back
                </Button>
                <Button type="submit">Create Watch Folder</Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const WatchFolderConfig: React.FC<WatchFolderConfigProps> = ({
  watchFolders,
  integrationConnections,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onToggleFolder
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'error'>('all');

  const filteredFolders = watchFolders.filter(folder => 
    filter === 'all' || folder.status === filter
  );

  const activeFolders = watchFolders.filter(f => f.status === 'active').length;
  const errorFolders = watchFolders.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Watch Folders</h3>
          <p className="text-sm text-muted-foreground">
            Automatically monitor folders for new audio files
          </p>
        </div>
        <CreateFolderDialog
          integrationConnections={integrationConnections}
          onCreateFolder={onCreateFolder}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{watchFolders.length}</div>
            <p className="text-xs text-muted-foreground">Total Folders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{activeFolders}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">
              {watchFolders.filter(f => f.status === 'paused').length}
            </div>
            <p className="text-xs text-muted-foreground">Paused</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{errorFolders}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'paused', 'error'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Folder List */}
      {filteredFolders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onUpdate={onUpdateFolder}
              onDelete={onDeleteFolder}
              onToggle={onToggleFolder}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <FolderOpen size={48} className="mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Watch Folders</h4>
            <p className="text-muted-foreground mb-4">
              Create your first watch folder to automatically process audio files.
            </p>
            <CreateFolderDialog
              integrationConnections={integrationConnections}
              onCreateFolder={onCreateFolder}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WatchFolderConfig;