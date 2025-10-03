import { motion } from 'framer-motion';
import {
  Settings,
  Plus,
  Search,
  Filter,
  Grid3x3,
  List,
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import CloudStorageConnector, { IntegrationConnection } from './cloud-storage-connector';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from './dropdown-menu';
import { Input } from './input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import WatchFolderConfig, { WatchFolder } from './watch-folder-config';
import WorkflowAutomation, { WorkflowAutomation as Workflow } from './workflow-automation';

interface IntegrationHubProps {
  // Cloud Storage
  integrationConnections: IntegrationConnection[];
  onConnectIntegration: (provider: string) => void;
  onDisconnectIntegration: (connectionId: string) => void;
  onRefreshIntegration: (connectionId: string) => void;
  onConfigureIntegration: (connectionId: string) => void;

  // Watch Folders
  watchFolders: WatchFolder[];
  onCreateWatchFolder: (folder: Partial<WatchFolder>) => void;
  onUpdateWatchFolder: (id: string, updates: Partial<WatchFolder>) => void;
  onDeleteWatchFolder: (id: string) => void;
  onToggleWatchFolder: (id: string, active: boolean) => void;

  // Workflows
  workflows: Workflow[];
  onCreateWorkflow: (workflow: Partial<Workflow>) => void;
  onUpdateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  onDeleteWorkflow: (id: string) => void;
  onToggleWorkflow: (id: string, active: boolean) => void;
  onTestWorkflow: (id: string) => void;
}

const IntegrationStats: React.FC<{
  connections: IntegrationConnection[];
  watchFolders: WatchFolder[];
  workflows: Workflow[];
}> = ({ connections, watchFolders, workflows }) => {
  const activeConnections = connections.filter(c => c.status === 'connected').length;
  const activeWatchFolders = watchFolders.filter(w => w.status === 'active').length;
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const totalExecutions = workflows.reduce((sum, w) => sum + w.executionCount, 0);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{activeConnections}</div>
              <p className="text-xs text-muted-foreground">Active Connections</p>
            </div>
            <CheckCircle className="text-success" size={20} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{activeWatchFolders}</div>
              <p className="text-xs text-muted-foreground">Watch Folders</p>
            </div>
            <Clock className="text-primary" size={20} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{activeWorkflows}</div>
              <p className="text-xs text-muted-foreground">Workflows</p>
            </div>
            <TrendingUp className="text-warning" size={20} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{totalExecutions}</div>
              <p className="text-xs text-muted-foreground">Total Executions</p>
            </div>
            <Star className="text-accent" size={20} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const QuickActions: React.FC<{
  onQuickConnect: (provider: string) => void;
  onQuickFolder: () => void;
  onQuickWorkflow: () => void;
}> = ({ onQuickConnect, onQuickFolder, onQuickWorkflow }) => {
  const quickConnections = [
    { provider: 'google_drive', name: 'Google Drive', popular: true },
    { provider: 'dropbox', name: 'Dropbox', popular: true },
    { provider: 'zapier', name: 'Zapier', popular: true },
    { provider: 'notion', name: 'Notion', popular: false },
    { provider: 'slack', name: 'Slack', popular: false },
    { provider: 'n8n', name: 'n8n', popular: false }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Get started with popular integrations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickConnections.slice(0, 4).map((conn) => (
            <Button
              key={conn.provider}
              variant="outline"
              size="sm"
              onClick={() => onQuickConnect(conn.provider)}
              className="justify-start"
            >
              <Plus size={14} className="mr-2" />
              {conn.name}
              {conn.popular && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Popular
                </Badge>
              )}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={onQuickFolder}
            className="justify-start"
          >
            <Plus size={14} className="mr-2" />
            Watch Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onQuickWorkflow}
            className="justify-start"
          >
            <Plus size={14} className="mr-2" />
            Workflow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const RecentActivity: React.FC<{
  connections: IntegrationConnection[];
  workflows: Workflow[];
}> = ({ connections, workflows }) => {
  const recentItems = [
    ...connections.map(conn => ({
      id: conn.id,
      type: 'connection' as const,
      title: `Connected to ${conn.provider}`,
      timestamp: conn.lastSyncAt || conn.createdAt,
      status: conn.status
    })),
    ...workflows.map(workflow => ({
      id: workflow.id,
      type: 'workflow' as const,
      title: `Workflow "${workflow.name}" executed`,
      timestamp: workflow.lastExecutedAt || workflow.createdAt,
      status: workflow.status
    }))
  ]
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge 
                  variant={item.status === 'active' || item.status === 'connected' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {item.status}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const IntegrationHub: React.FC<IntegrationHubProps> = ({
  integrationConnections,
  onConnectIntegration,
  onDisconnectIntegration,
  onRefreshIntegration,
  onConfigureIntegration,
  watchFolders,
  onCreateWatchFolder,
  onUpdateWatchFolder,
  onDeleteWatchFolder,
  onToggleWatchFolder,
  workflows,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  onToggleWorkflow,
  onTestWorkflow
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integration Hub</h2>
          <p className="text-muted-foreground">
            Connect VoiceFlowPro with your favorite services and automate your workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border-border">
              <DropdownMenuCheckboxItem checked>
                All Integrations
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>
                Connected Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>
                Storage Providers
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>
                Automation Tools
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3x3 size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <IntegrationStats
        connections={integrationConnections}
        watchFolders={watchFolders}
        workflows={workflows}
      />

      {/* Quick Actions */}
      <QuickActions
        onQuickConnect={onConnectIntegration}
        onQuickFolder={() => {/* Trigger watch folder dialog */}}
        onQuickWorkflow={() => {/* Trigger workflow dialog */}}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="connections" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connections">Cloud Storage</TabsTrigger>
              <TabsTrigger value="folders">Watch Folders</TabsTrigger>
              <TabsTrigger value="workflows">Automation</TabsTrigger>
            </TabsList>

            <TabsContent value="connections" className="space-y-4">
              <CloudStorageConnector
                connections={integrationConnections}
                onConnect={onConnectIntegration}
                onDisconnect={onDisconnectIntegration}
                onRefresh={onRefreshIntegration}
                onConfigure={onConfigureIntegration}
              />
            </TabsContent>

            <TabsContent value="folders" className="space-y-4">
              <WatchFolderConfig
                watchFolders={watchFolders}
                integrationConnections={integrationConnections}
                onCreateFolder={onCreateWatchFolder}
                onUpdateFolder={onUpdateWatchFolder}
                onDeleteFolder={onDeleteWatchFolder}
                onToggleFolder={onToggleWatchFolder}
              />
            </TabsContent>

            <TabsContent value="workflows" className="space-y-4">
              <WorkflowAutomation
                workflows={workflows}
                integrationConnections={integrationConnections}
                onCreateWorkflow={onCreateWorkflow}
                onUpdateWorkflow={onUpdateWorkflow}
                onDeleteWorkflow={onDeleteWorkflow}
                onToggleWorkflow={onToggleWorkflow}
                onTestWorkflow={onTestWorkflow}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <RecentActivity
            connections={integrationConnections}
            workflows={workflows}
          />

          {/* Health Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Connections</span>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  <span className="text-sm">All Good</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Watch Folders</span>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  <span className="text-sm">Monitoring</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Workflows</span>
                <div className="flex items-center gap-2">
                  {workflows.some(w => w.status === 'error') ? (
                    <>
                      <AlertTriangle size={16} className="text-warning" />
                      <span className="text-sm">Issues Detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="text-success" />
                      <span className="text-sm">Running</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IntegrationHub;