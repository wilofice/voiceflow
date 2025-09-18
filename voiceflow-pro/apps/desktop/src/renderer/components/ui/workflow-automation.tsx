import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Link,
  Settings,
  Play,
  Pause,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Target,
  Send,
  FileText,
  MessageSquare,
  Webhook
} from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Switch } from './switch';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Textarea } from './textarea';
import { Separator } from './separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from './form';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from './use-toast';

export interface WorkflowAutomation {
  id: string;
  name: string;
  description?: string;
  provider: 'zapier' | 'n8n' | 'custom_webhook';
  status: 'active' | 'paused' | 'error';
  trigger: {
    event: 'transcript_completed' | 'batch_completed' | 'export_created' | 'manual';
    conditions?: {
      projectIds?: string[];
      tags?: string[];
      minDuration?: number;
      language?: string;
    };
  };
  actions: Array<{
    type: 'webhook' | 'notification' | 'export' | 'integration';
    config: {
      url?: string;
      method?: 'POST' | 'PUT' | 'PATCH';
      headers?: Record<string, string>;
      payload?: string;
      integrationId?: string;
      exportPresetId?: string;
    };
  }>;
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowAutomationProps {
  workflows: WorkflowAutomation[];
  integrationConnections: Array<{
    id: string;
    provider: string;
    status: string;
    metadata: { accountName?: string };
  }>;
  onCreateWorkflow: (workflow: Partial<WorkflowAutomation>) => void;
  onUpdateWorkflow: (id: string, updates: Partial<WorkflowAutomation>) => void;
  onDeleteWorkflow: (id: string) => void;
  onToggleWorkflow: (id: string, active: boolean) => void;
  onTestWorkflow: (id: string) => void;
}

const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  provider: z.enum(['zapier', 'n8n', 'custom_webhook']),
  triggerEvent: z.enum(['transcript_completed', 'batch_completed', 'export_created', 'manual']),
  webhookUrl: z.string().url('Must be a valid URL'),
  webhookMethod: z.enum(['POST', 'PUT', 'PATCH']).default('POST'),
  webhookHeaders: z.string().optional(),
  webhookPayload: z.string().optional(),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

const providerConfig = {
  zapier: {
    name: 'Zapier',
    icon: Zap,
    color: 'bg-orange-500',
    description: 'Connect to 5000+ apps'
  },
  n8n: {
    name: 'n8n',
    icon: Link,
    color: 'bg-pink-500',
    description: 'Self-hosted automation'
  },
  custom_webhook: {
    name: 'Custom Webhook',
    icon: Webhook,
    color: 'bg-gray-600',
    description: 'HTTP endpoint integration'
  }
};

const triggerConfig = {
  transcript_completed: {
    name: 'Transcript Completed',
    icon: FileText,
    description: 'When a single transcript is finished'
  },
  batch_completed: {
    name: 'Batch Completed', 
    icon: Activity,
    description: 'When a batch job finishes'
  },
  export_created: {
    name: 'Export Created',
    icon: Send,
    description: 'When an export is generated'
  },
  manual: {
    name: 'Manual Trigger',
    icon: Play,
    description: 'Triggered manually by user'
  }
};

const WorkflowCard: React.FC<{
  workflow: WorkflowAutomation;
  onUpdate: (id: string, updates: Partial<WorkflowAutomation>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onTest: (id: string) => void;
}> = ({ workflow, onUpdate, onDelete, onToggle, onTest }) => {
  const config = providerConfig[workflow.provider];
  const triggerInfo = triggerConfig[workflow.trigger.event];
  const IconComponent = config.icon;
  const TriggerIcon = triggerInfo.icon;
  
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

  const StatusIcon = getStatusIcon(workflow.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color} text-white`}>
              <IconComponent size={16} />
            </div>
            <div>
              <CardTitle className="text-sm">{workflow.name}</CardTitle>
              <CardDescription className="text-xs">
                {workflow.description || config.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(workflow.status)}>
              <StatusIcon size={12} className="mr-1" />
              {workflow.status}
            </Badge>
            <Switch
              checked={workflow.status === 'active'}
              onCheckedChange={(checked) => onToggle(workflow.id, checked)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border-border">
                <DropdownMenuItem onClick={() => onTest(workflow.id)}>
                  <Play size={14} className="mr-2" />
                  Test Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Edit size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Activity size={14} className="mr-2" />
                  View Logs
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(workflow.id)}
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
        <div className="space-y-3">
          {/* Trigger Info */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TriggerIcon size={12} />
              <span>{triggerInfo.name}</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="text-muted-foreground">
              {workflow.actions.length} action{workflow.actions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Executions:</span> {workflow.executionCount}
            </div>
            <div>
              <span className="font-medium">Last run:</span>{' '}
              {workflow.lastExecutedAt 
                ? new Date(workflow.lastExecutedAt).toLocaleDateString()
                : 'Never'
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CreateWorkflowDialog: React.FC<{
  integrationConnections: Array<{
    id: string;
    provider: string;
    status: string;
    metadata: { accountName?: string };
  }>;
  onCreateWorkflow: (workflow: Partial<WorkflowAutomation>) => void;
}> = ({ integrationConnections, onCreateWorkflow }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'provider' | 'trigger' | 'action'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');

  const form = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      webhookMethod: 'POST'
    }
  });

  const onSubmit = (data: WorkflowFormData) => {
    const headers = data.webhookHeaders 
      ? JSON.parse(data.webhookHeaders)
      : { 'Content-Type': 'application/json' };

    onCreateWorkflow({
      name: data.name,
      description: data.description,
      provider: data.provider,
      status: 'active',
      trigger: {
        event: data.triggerEvent
      },
      actions: [{
        type: 'webhook',
        config: {
          url: data.webhookUrl,
          method: data.webhookMethod,
          headers,
          payload: data.webhookPayload
        }
      }],
      executionCount: 0
    });

    setIsOpen(false);
    setStep('provider');
    form.reset();
    toast({
      title: "Workflow Created",
      description: `${data.name} workflow is now active.`,
    });
  };

  const availableProviders = Object.keys(providerConfig) as Array<keyof typeof providerConfig>;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} className="mr-2" />
          Create Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Automation Workflow</DialogTitle>
          <DialogDescription>
            Set up automated actions triggered by transcription events.
          </DialogDescription>
        </DialogHeader>

        {step === 'provider' && (
          <div className="space-y-4">
            <h4 className="font-medium">Choose Automation Provider</h4>
            <div className="grid grid-cols-1 gap-3">
              {availableProviders.map((provider) => {
                const config = providerConfig[provider];
                const IconComponent = config.icon;
                return (
                  <Card 
                    key={provider}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedProvider === provider ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedProvider(provider);
                      form.setValue('provider', provider);
                    }}
                  >
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
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={() => setStep('trigger')}
                disabled={!selectedProvider}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'trigger' && (
          <div className="space-y-4">
            <h4 className="font-medium">Choose Trigger Event</h4>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(triggerConfig).map(([key, config]) => {
                const IconComponent = config.icon;
                return (
                  <Card 
                    key={key}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedTrigger === key ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedTrigger(key);
                      form.setValue('triggerEvent', key as any);
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                          <IconComponent size={20} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm">{config.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {config.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep('provider')}>
                Back
              </Button>
              <Button 
                onClick={() => setStep('action')}
                disabled={!selectedTrigger}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'action' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workflow Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Automation Workflow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of this workflow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Webhook Configuration</h4>
                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://hooks.zapier.com/hooks/catch/..." {...field} />
                      </FormControl>
                      <FormDescription>
                        The HTTP endpoint that will receive the transcription data
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="webhookMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HTTP Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="webhookHeaders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Headers (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional custom headers as JSON object
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="webhookPayload"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Payload Template</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Leave empty to send default transcript data"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional custom payload template. Use variables like {'{transcript_id}'}, {'{text}'}, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep('trigger')}>
                  Back
                </Button>
                <Button type="submit">Create Workflow</Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const WorkflowAutomation: React.FC<WorkflowAutomationProps> = ({
  workflows,
  integrationConnections,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  onToggleWorkflow,
  onTestWorkflow
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'error'>('all');

  const filteredWorkflows = workflows.filter(workflow => 
    filter === 'all' || workflow.status === filter
  );

  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const totalExecutions = workflows.reduce((sum, w) => sum + w.executionCount, 0);
  const errorWorkflows = workflows.filter(w => w.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Workflow Automation</h3>
          <p className="text-sm text-muted-foreground">
            Automate actions when transcription events occur
          </p>
        </div>
        <CreateWorkflowDialog
          integrationConnections={integrationConnections}
          onCreateWorkflow={onCreateWorkflow}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{workflows.length}</div>
            <p className="text-xs text-muted-foreground">Total Workflows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{activeWorkflows}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalExecutions}</div>
            <p className="text-xs text-muted-foreground">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{errorWorkflows}</div>
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

      {/* Workflow List */}
      {filteredWorkflows.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onUpdate={onUpdateWorkflow}
              onDelete={onDeleteWorkflow}
              onToggle={onToggleWorkflow}
              onTest={onTestWorkflow}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Zap size={48} className="mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Workflows</h4>
            <p className="text-muted-foreground mb-4">
              Create your first automation workflow to connect VoiceFlowPro with other services.
            </p>
            <CreateWorkflowDialog
              integrationConnections={integrationConnections}
              onCreateWorkflow={onCreateWorkflow}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkflowAutomation;