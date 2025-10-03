import { motion } from 'framer-motion';
import React, { useRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface WaveformData {
  peaks: number[];
  duration: number;
}

interface WaveformVisualizerProps {
  className?: string;
  data?: WaveformData;
  currentTime?: number;
  isPlaying?: boolean;
  height?: number;
  barWidth?: number;
  barGap?: number;
  onSeek?: (time: number) => void;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  className,
  data,
  currentTime = 0,
  isPlaying = false,
  height = 80,
  barWidth = 2,
  barGap = 1,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Generate mock waveform data if none provided
  const waveformData = data || {
    peaks: Array.from({ length: 200 }, (_, i) => 
      Math.sin(i * 0.1) * 0.5 + Math.random() * 0.5 + 0.2
    ),
    duration: 180000, // 3 minutes in ms
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const containerWidth = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, containerWidth, height);

    // Calculate bar dimensions
    const totalBars = waveformData.peaks.length;
    const availableWidth = containerWidth - (totalBars - 1) * barGap;
    const actualBarWidth = Math.max(1, availableWidth / totalBars);
    
    // Calculate current position
    const progressRatio = waveformData.duration > 0 ? currentTime / waveformData.duration : 0;
    const currentBarIndex = Math.floor(progressRatio * totalBars);

    // Draw waveform bars
    waveformData.peaks.forEach((peak, index) => {
      const x = index * (actualBarWidth + barGap);
      const barHeight = Math.max(2, peak * (height - 4));
      const y = (height - barHeight) / 2;
      
      // Determine color based on position and state
      let color = '#6B7280'; // Default inactive color
      
      if (index <= currentBarIndex) {
        color = '#3B82F6'; // Active/played color (primary blue)
      }
      
      if (isHovering) {
        const hoverBarIndex = Math.floor((hoverPosition / containerWidth) * totalBars);
        if (index <= hoverBarIndex) {
          color = '#60A5FA'; // Hover preview color (lighter blue)
        }
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, actualBarWidth, barHeight);
    });

    // Draw playhead
    if (progressRatio > 0) {
      const playheadX = progressRatio * containerWidth;
      ctx.strokeStyle = '#F59E0B'; // Warning/accent color for playhead
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

  }, [waveformData, currentTime, height, barWidth, barGap, isHovering, hoverPosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverPosition(x);
  };

  const handleClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container || !onSeek) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / container.clientWidth;
    const newTime = ratio * waveformData.duration;
    
    onSeek(newTime);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleClick}
        data-testid="waveform-visualizer"
      >
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ height: `${height}px` }}
        />
        
        {/* Hover indicator */}
        {isHovering && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-text-secondary/50 pointer-events-none"
            style={{ left: `${hoverPosition}px` }}
          />
        )}
        
        {/* Time indicators */}
        <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-text-secondary">
          <span>0:00</span>
          <span>{Math.floor(waveformData.duration / 60000)}:{String(Math.floor((waveformData.duration % 60000) / 1000)).padStart(2, '0')}</span>
        </div>
      </div>
      
      {/* Loading animation */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{ width: '30%' }}
          />
        </div>
      )}
    </div>
  );
};

export default WaveformVisualizer;