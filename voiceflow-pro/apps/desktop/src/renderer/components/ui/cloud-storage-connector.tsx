import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cloud,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Settings,
  Zap,
  Link,
  Folder,
  RefreshCw,
  Trash2,
  MoreVertical,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Switch } from './switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { toast } from './use-toast';

export interface IntegrationConnection {
  id: string;
  provider: 'google_drive' | 'dropbox' | 'onedrive' | 'notion' | 'slack' | 'zapier' | 'n8n' | 'custom_webhook';
  status: 'connected' | 'expired' | 'error' | 'revoked';
  scopes: string[];
  metadata: {
    accountName?: string;
    email?: string;
    quotaUsed?: number;
    quotaTotal?: number;
    folderCount?: number;
    lastSyncAt?: string;
  };
  lastSyncAt?: string;
  createdAt: string;
}

interface CloudStorageConnectorProps {
  connections: IntegrationConnection[];
  onConnect: (provider: string) => void;
  onDisconnect: (connectionId: string) => void;
  onRefresh: (connectionId: string) => void;
  onConfigure: (connectionId: string) => void;
}

const providerConfig = {
  google_drive: {
    name: 'Google Drive',
    icon: Cloud,
    color: 'bg-blue-500',
    description: 'Access files from Google Drive'
  },
  dropbox: {
    name: 'Dropbox',
    icon: Cloud,
    color: 'bg-blue-600',
    description: 'Sync with Dropbox folders'
  },
  onedrive: {
    name: 'OneDrive',
    icon: Cloud,
    color: 'bg-blue-700',
    description: 'Connect to Microsoft OneDrive'
  },
  notion: {
    name: 'Notion',
    icon: FileText,
    color: 'bg-gray-800',
    description: 'Export to Notion pages'
  },
  slack: {
    name: 'Slack',
    icon: MessageSquare,
    color: 'bg-purple-600',
    description: 'Send transcripts to Slack channels'
  },
  zapier: {
    name: 'Zapier',
    icon: Zap,
    color: 'bg-orange-500',
    description: 'Automate workflows with Zapier'
  },
  n8n: {
    name: 'n8n',
    icon: Link,
    color: 'bg-pink-500',
    description: 'Self-hosted workflow automation'
  },
  custom_webhook: {
    name: 'Custom Webhook',
    icon: Settings,
    color: 'bg-gray-600',
    description: 'Custom HTTP endpoints'
  }
};

const ConnectionCard: React.FC<{
  connection: IntegrationConnection;
  onDisconnect: (id: string) => void;
  onRefresh: (id: string) => void;
  onConfigure: (id: string) => void;
}> = ({ connection, onDisconnect, onRefresh, onConfigure }) => {
  const config = providerConfig[connection.provider];
  const IconComponent = config.icon;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-success text-success-foreground';
      case 'expired': return 'bg-warning text-warning-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      case 'revoked': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return CheckCircle;
      case 'expired': return AlertCircle;
      case 'error': return AlertCircle;
      case 'revoked': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const StatusIcon = getStatusIcon(connection.status);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color} text-white`}>
              <IconComponent size={16} />
            </div>
            <div>
              <CardTitle className="text-sm">{config.name}</CardTitle>
              <CardDescription className="text-xs">
                {connection.metadata.accountName || connection.metadata.email}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(connection.status)}>
              <StatusIcon size={12} className="mr-1" />
              {connection.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border-border">
                <DropdownMenuItem onClick={() => onRefresh(connection.id)}>
                  <RefreshCw size={14} className="mr-2" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onConfigure(connection.id)}>
                  <Settings size={14} className="mr-2" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDisconnect(connection.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {connection.metadata.quotaUsed && connection.metadata.quotaTotal && (
            <div className="text-xs text-muted-foreground">
              Storage: {(connection.metadata.quotaUsed / (1024 * 1024 * 1024)).toFixed(1)}GB / 
              {(connection.metadata.quotaTotal / (1024 * 1024 * 1024)).toFixed(1)}GB
            </div>
          )}
          {connection.metadata.folderCount && (
            <div className="text-xs text-muted-foreground">
              {connection.metadata.folderCount} folders monitored
            </div>
          )}
          {connection.lastSyncAt && (
            <div className="text-xs text-muted-foreground">
              Last sync: {new Date(connection.lastSyncAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ProviderCard: React.FC<{
  provider: keyof typeof providerConfig;
  isConnected: boolean;
  onConnect: () => void;
}> = ({ provider, isConnected, onConnect }) => {
  const config = providerConfig[provider];
  const IconComponent = config.icon;

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${config.color} text-white`}>
            <IconComponent size={20} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm">{config.name}</CardTitle>
            <CardDescription className="text-xs">
              {config.description}
            </CardDescription>
          </div>
          <Button
            onClick={onConnect}
            disabled={isConnected}
            size="sm"
            variant={isConnected ? "outline" : "default"}
          >
            {isConnected ? 'Connected' : 'Connect'}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
};

export const CloudStorageConnector: React.FC<CloudStorageConnectorProps> = ({
  connections,
  onConnect,
  onDisconnect,
  onRefresh,
  onConfigure
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [category, setCategory] = useState<'storage' | 'automation' | 'collaboration'>('storage');

  const getConnectedProviders = () => {
    return new Set(connections.map(conn => conn.provider));
  };

  const connectedProviders = getConnectedProviders();

  const handleConnect = (provider: string) => {
    onConnect(provider);
    toast({
      title: "Integration Started",
      description: `Connecting to ${providerConfig[provider as keyof typeof providerConfig].name}...`,
    });
  };

  const storageProviders = ['google_drive', 'dropbox', 'onedrive'] as const;
  const automationProviders = ['zapier', 'n8n', 'custom_webhook'] as const;
  const collaborationProviders = ['notion', 'slack'] as const;

  const categoryProviders = {
    storage: storageProviders,
    automation: automationProviders,
    collaboration: collaborationProviders
  };

  return (
    <div className="space-y-6">
      {/* Connected Integrations */}
      {connections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Connected Integrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onDisconnect={onDisconnect}
                onRefresh={onRefresh}
                onConfigure={onConfigure}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Integration Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Available Integrations</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Cloud size={16} className="mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connect Integration</DialogTitle>
              <DialogDescription>
                Choose a service to connect with VoiceFlowPro for automated workflows.
              </DialogDescription>
            </DialogHeader>
            
            {/* Category Tabs */}
            <div className="flex gap-2 mb-4">
              {Object.keys(categoryProviders).map((cat) => (
                <Button
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(cat as any)}
                  className="capitalize"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Provider Grid */}
            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
              {categoryProviders[category].map((provider) => (
                <ProviderCard
                  key={provider}
                  provider={provider}
                  isConnected={connectedProviders.has(provider)}
                  onConnect={() => {
                    handleConnect(provider);
                    setIsDialogOpen(false);
                  }}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{connections.filter(c => c.status === 'connected').length}</div>
            <p className="text-xs text-muted-foreground">Active Connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {connections.reduce((sum, c) => sum + (c.metadata.folderCount || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Folders Monitored</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{connections.filter(c => c.status === 'error').length}</div>
            <p className="text-xs text-muted-foreground">Needs Attention</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CloudStorageConnector;