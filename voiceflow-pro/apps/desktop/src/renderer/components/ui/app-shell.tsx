import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Minus, 
  Square, 
  Settings,
  Search,
  Bell,
} from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


interface AppShellProps {
  children?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  title?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  sidebar,
  className,
  title = "VoiceFlowPro"
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Platform detection for window controls
  const platform = typeof window !== 'undefined' 
    ? navigator.platform.toLowerCase()
    : 'unknown';
  
  const isMac = platform.includes('mac');
  const isWindows = platform.includes('win');

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col overflow-hidden",
      className
    )}>
      {/* Desktop App Header */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="focus-ring"
            data-testid="sidebar-toggle"
          >
            <Menu className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-primary flex items-center justify-center">
              <span className="text-xs font-bold text-white">V</span>
            </div>
            <span className="font-semibold text-text-primary">{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="focus-ring">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="focus-ring">
            <Bell className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="focus-ring">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 ml-auto">
          {isMac ? (
            // macOS Traffic Light Controls
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer" />
            </div>
          ) : (
            // Windows Controls
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="focus-ring hover:bg-surface-alt">
                <Minus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="focus-ring hover:bg-surface-alt">
                <Square className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="focus-ring hover:bg-destructive hover:text-destructive-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {sidebarOpen && sidebar && (
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 200,
                duration: 0.3 
              }}
              className={cn(
                "w-[280px] bg-sidebar border-r border-sidebar-border",
                "flex flex-col shadow-lg z-10"
              )}
              data-testid="app-sidebar"
            >
              {sidebar}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main 
          className={cn(
            "flex-1 bg-background overflow-auto",
            "transition-all duration-300 ease-in-out"
          )}
          data-testid="main-content"
        >
          {children}
        </main>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-surface-alt/50 border-t border-border px-4 flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
          <span>Local Processing</span>
        </div>
        <div className="flex items-center gap-4">
          <span>CPU: 12%</span>
          <span>Memory: 2.1GB</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;