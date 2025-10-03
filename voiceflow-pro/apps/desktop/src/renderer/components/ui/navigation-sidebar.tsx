import { motion } from 'framer-motion';
import { 
  Home,
  Mic,
  FileAudio,
  FolderOpen,
  History,
  Settings,
  Download,
  Upload,
  Play,
  Pause,
  MoreHorizontal,
  Folder,
  Clock,
  Star,
  FileText,
  Zap,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  badge?: number | string;
  isActive?: boolean;
  children?: NavigationItem[];
}

interface Project {
  id: string;
  name: string;
  color: string;
  transcriptCount: number;
  isActive?: boolean;
}

interface RecentFile {
  id: string;
  title: string;
  status: 'completed' | 'processing' | 'error' | 'queued';
  duration?: string;
  timestamp: string;
}

interface NavigationSidebarProps {
  className?: string;
  projects?: Project[];
  recentFiles?: RecentFile[];
  onNavigate?: (item: NavigationItem) => void;
}

const mainNavItems: NavigationItem[] = [
  { id: 'home', label: 'Dashboard', icon: Home, isActive: true },
  { id: 'transcribe', label: 'New Transcription', icon: Mic, badge: 'Pro' },
  { id: 'batch', label: 'Batch Processing', icon: Zap },
  { id: 'realtime', label: 'Live Transcription', icon: Play, badge: 'Beta' },
];

const libraryItems: NavigationItem[] = [
  { id: 'all-transcripts', label: 'All Transcripts', icon: FileText, badge: 247 },
  { id: 'starred', label: 'Starred', icon: Star, badge: 12 },
  { id: 'recent', label: 'Recent', icon: Clock, badge: 8 },
  { id: 'watch-folders', label: 'Watch Folders', icon: FolderOpen, badge: 3 },
];

const mockProjects: Project[] = [
  { id: '1', name: 'Podcast Interviews', color: '#3B82F6', transcriptCount: 45, isActive: true },
  { id: '2', name: 'Research Sessions', color: '#10B981', transcriptCount: 23 },
  { id: '3', name: 'Meeting Notes', color: '#F59E0B', transcriptCount: 67 },
  { id: '4', name: 'Client Calls', color: '#EF4444', transcriptCount: 31 },
];

const mockRecentFiles: RecentFile[] = [
  { id: '1', title: 'Team Standup 03-15', status: 'completed', duration: '23:45', timestamp: '2 hours ago' },
  { id: '2', title: 'Customer Interview #12', status: 'processing', timestamp: '1 hour ago' },
  { id: '3', title: 'Podcast Episode 47', status: 'completed', duration: '1:12:33', timestamp: '3 hours ago' },
  { id: '4', title: 'Research Call - Sarah', status: 'error', timestamp: '5 hours ago' },
];

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  className,
  projects = mockProjects,
  recentFiles = mockRecentFiles,
  onNavigate,
}) => {
  const [expandedProjects, setExpandedProjects] = useState(true);
  const [expandedRecent, setExpandedRecent] = useState(true);

  const getStatusColor = (status: RecentFile['status']) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'processing':
        return 'text-primary animate-pulse';
      case 'error':
        return 'text-danger';
      case 'queued':
        return 'text-warning';
      default:
        return 'text-text-secondary';
    }
  };

  const getStatusIcon = (status: RecentFile['status']) => {
    switch (status) {
      case 'completed':
        return <div className="w-2 h-2 rounded-full bg-success" />;
      case 'processing':
        return <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-danger" />;
      case 'queued':
        return <div className="w-2 h-2 rounded-full bg-warning" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-text-muted" />;
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-sidebar text-sidebar-foreground", className)}>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Main Navigation */}
          <section>
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={item.isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-10 focus-ring",
                      item.isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                    )}
                    onClick={() => onNavigate?.(item)}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <Badge 
                        variant={typeof item.badge === 'string' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
          </section>

          <Separator className="bg-sidebar-border" />

          {/* Library Section */}
          <section>
            <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-3">
              Library
            </h3>
            <nav className="space-y-1">
              {libraryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-9 hover:bg-sidebar-accent/50 text-sidebar-foreground focus-ring"
                    onClick={() => onNavigate?.(item)}
                    data-testid={`library-${item.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <Badge variant="outline" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
          </section>

          <Separator className="bg-sidebar-border" />

          {/* Projects Section */}
          <section>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 hover:bg-sidebar-accent/50 text-sidebar-foreground focus-ring p-0"
              onClick={() => setExpandedProjects(!expandedProjects)}
            >
              {expandedProjects ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                Projects
              </h3>
            </Button>
            
            <motion.div
              initial={false}
              animate={{ height: expandedProjects ? 'auto' : 0, opacity: expandedProjects ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <nav className="space-y-1 mt-2">
                {projects.map((project) => (
                  <Button
                    key={project.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 h-9 hover:bg-sidebar-accent/50 focus-ring",
                      project.isActive 
                        ? "bg-sidebar-accent/30 text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground"
                    )}
                    onClick={() => onNavigate?.({ id: project.id, label: project.name, icon: Folder })}
                    data-testid={`project-${project.id}`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 text-left truncate">{project.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {project.transcriptCount}
                    </Badge>
                  </Button>
                ))}
              </nav>
            </motion.div>
          </section>

          <Separator className="bg-sidebar-border" />

          {/* Recent Files Section */}
          <section>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 hover:bg-sidebar-accent/50 text-sidebar-foreground focus-ring p-0"
              onClick={() => setExpandedRecent(!expandedRecent)}
            >
              {expandedRecent ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                Recent Files
              </h3>
            </Button>
            
            <motion.div
              initial={false}
              animate={{ height: expandedRecent ? 'auto' : 0, opacity: expandedRecent ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 mt-2">
                {recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent/30 cursor-pointer transition-colors focus-ring"
                    data-testid={`recent-${file.id}`}
                  >
                    {getStatusIcon(file.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {file.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
                        <span>{file.timestamp}</span>
                        {file.duration && (
                          <>
                            <span>•</span>
                            <span>{file.duration}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 focus-ring">
            <Download className="w-4 h-4" />
            <span>Updates</span>
            <Badge variant="outline" className="ml-auto">
              2
            </Badge>
          </Button>
          <Button variant="ghost" size="sm" className="focus-ring">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NavigationSidebar;