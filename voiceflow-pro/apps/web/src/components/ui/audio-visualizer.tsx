"use client";

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface AudioVisualizerProps {
  audioData?: Float32Array | null;
  isActive?: boolean;
  variant?: 'waveform' | 'bars' | 'circle';
  className?: string;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function AudioVisualizer({
  audioData = null,
  isActive = false,
  variant = 'waveform',
  className = '',
  width = 300,
  height = 60,
  color = '#60a5fa',
  backgroundColor = '#1e40af'
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = isActive ? backgroundColor : '#6b7280';
      ctx.fillRect(0, 0, width, height);

      if (!audioData || audioData.length === 0) {
        // Draw idle state
        drawIdleState(ctx, width, height, isActive);
      } else {
        // Draw audio data based on variant
        switch (variant) {
          case 'waveform':
            drawWaveform(ctx, audioData, width, height, color, isActive);
            break;
          case 'bars':
            drawBars(ctx, audioData, width, height, color, isActive);
            break;
          case 'circle':
            drawCircle(ctx, audioData, width, height, color, isActive);
            break;
        }
      }

      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioData, isActive, variant, width, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('border rounded', className)}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
}

function drawIdleState(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isActive: boolean
) {
  const centerY = height / 2;
  const amplitude = 2;
  const frequency = 0.02;
  const time = Date.now() * 0.001;

  ctx.strokeStyle = isActive ? '#60a5fa' : '#9ca3af';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    const y = centerY + Math.sin(x * frequency + time) * amplitude;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  audioData: Float32Array,
  width: number,
  height: number,
  color: string,
  isActive: boolean
) {
  ctx.strokeStyle = isActive ? color : '#9ca3af';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const sliceWidth = width / audioData.length;
  let x = 0;

  for (let i = 0; i < audioData.length; i++) {
    const v = (audioData[i] + 1) / 2; // Normalize from [-1, 1] to [0, 1]
    const y = v * height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.stroke();
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  audioData: Float32Array,
  width: number,
  height: number,
  color: string,
  isActive: boolean
) {
  const barCount = Math.min(64, audioData.length);
  const barWidth = width / barCount;
  const samplesPerBar = Math.floor(audioData.length / barCount);

  ctx.fillStyle = isActive ? color : '#9ca3af';

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const startIndex = i * samplesPerBar;
    const endIndex = Math.min(startIndex + samplesPerBar, audioData.length);

    // Average the samples for this bar
    for (let j = startIndex; j < endIndex; j++) {
      sum += Math.abs(audioData[j]);
    }
    
    const average = sum / (endIndex - startIndex);
    const barHeight = (average * height) * 2; // Amplify for better visualization
    
    const x = i * barWidth;
    const y = height - barHeight;
    
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  audioData: Float32Array,
  width: number,
  height: number,
  color: string,
  isActive: boolean
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) / 4;
  
  // Calculate average amplitude
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += Math.abs(audioData[i]);
  }
  const averageAmplitude = sum / audioData.length;
  
  // Draw base circle
  ctx.strokeStyle = isActive ? color : '#9ca3af';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw amplitude circle
  const amplitudeRadius = baseRadius + (averageAmplitude * baseRadius);
  ctx.strokeStyle = isActive ? color : '#9ca3af';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(centerX, centerY, amplitudeRadius, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.globalAlpha = 1;
  
  // Draw frequency bars around circle
  const barCount = 32;
  const angleStep = (2 * Math.PI) / barCount;
  const samplesPerBar = Math.floor(audioData.length / barCount);
  
  ctx.fillStyle = isActive ? color : '#9ca3af';
  
  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const startIndex = i * samplesPerBar;
    const endIndex = Math.min(startIndex + samplesPerBar, audioData.length);
    
    for (let j = startIndex; j < endIndex; j++) {
      sum += Math.abs(audioData[j]);
    }
    
    const average = sum / (endIndex - startIndex);
    const barLength = average * (baseRadius / 2);
    
    const angle = i * angleStep;
    const innerRadius = baseRadius + 5;
    const outerRadius = innerRadius + barLength * 20; // Amplify for visibility
    
    const x1 = centerX + Math.cos(angle) * innerRadius;
    const y1 = centerY + Math.sin(angle) * innerRadius;
    const x2 = centerX + Math.cos(angle) * outerRadius;
    const y2 = centerY + Math.sin(angle) * outerRadius;
    
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}