"use client";

import { forwardRef, createContext, useContext, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Accessibility Context for global a11y settings
interface AccessibilityContextType {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderOnly: boolean;
  focusVisible: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  reducedMotion: false,
  highContrast: false,
  screenReaderOnly: false,
  focusVisible: false,
});

export const useAccessibility = () => useContext(AccessibilityContext);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilityContextType>({
    reducedMotion: false,
    highContrast: false,
    screenReaderOnly: false,
    focusVisible: false,
  });

  useEffect(() => {
    // Detect user preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const focusVisible = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    setSettings({
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
      screenReaderOnly: false, // Can't auto-detect, user must enable
      focusVisible: !prefersReducedMotion, // Show focus indicators when motion is not reduced
    });
  }, []);

  return (
    <AccessibilityContext.Provider value={settings}>
      {children}
    </AccessibilityContext.Provider>
  );
}

// Screen Reader Only Text
export const ScreenReaderOnly = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ children, className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "absolute w-[1px] h-[1px] p-0 -m-[1px] overflow-hidden clip-[rect(0,0,0,0)] whitespace-nowrap border-0",
      className
    )}
    {...props}
  >
    {children}
  </span>
));
ScreenReaderOnly.displayName = "ScreenReaderOnly";

// Skip Link for keyboard navigation
export const SkipLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ href = "#main-content", children = "Skip to main content", className, ...props }, ref) => (
  <a
    ref={ref}
    href={href}
    className={cn(
      "absolute top-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded",
      "transform -translate-y-full opacity-0 transition-all",
      "focus:translate-y-0 focus:opacity-100",
      "hover:bg-blue-700",
      className
    )}
    {...props}
  >
    {children}
  </a>
));
SkipLink.displayName = "SkipLink";

// Focus Trap for modals and overlays
export function FocusTrap({ 
  children, 
  enabled = true,
  className,
  restoreFocus = true
}: {
  children: React.ReactNode;
  enabled?: boolean;
  className?: string;
  restoreFocus?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [previousFocus, setPreviousFocus] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Store previous focus
    setPreviousFocus(document.activeElement as HTMLElement);

    // Focus first element
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      if (restoreFocus && previousFocus) {
        previousFocus.focus();
      }
    };
  }, [enabled, container, restoreFocus]);

  return (
    <div ref={setContainer} className={className}>
      {children}
    </div>
  );
}

// Announcement for screen readers
export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  className,
  ...props
}: {
  children: React.ReactNode;
  politeness?: 'off' | 'polite' | 'assertive';
  atomic?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn("sr-only", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// High contrast toggle
export function HighContrastToggle({
  onToggle,
  enabled = false,
  className
}: {
  onToggle: (enabled: boolean) => void;
  enabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={cn(
        "flex items-center space-x-2 px-3 py-2 rounded border",
        "focus:ring-2 focus:ring-blue-500",
        enabled ? "bg-gray-900 text-white" : "bg-white text-gray-900 border-gray-300",
        className
      )}
      aria-pressed={enabled}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
        />
      </svg>
      <span>High Contrast</span>
    </button>
  );
}

// Progress indicator with screen reader support
export const AccessibleProgress = forwardRef<
  HTMLDivElement,
  {
    value: number;
    max?: number;
    label?: string;
    description?: string;
    showText?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
>(({ value, max = 100, label, description, showText = true, className, ...props }, ref) => {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div ref={ref} className={cn("space-y-1", className)} {...props}>
      {label && (
        <div className="flex justify-between text-sm">
          <span id="progress-label">{label}</span>
          {showText && <span aria-hidden="true">{percentage}%</span>}
        </div>
      )}
      
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={label ? "progress-label" : undefined}
        aria-describedby={description ? "progress-description" : undefined}
        className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
      >
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          aria-hidden="true"
        />
      </div>
      
      {description && (
        <p id="progress-description" className="text-xs text-gray-600">
          {description}
        </p>
      )}
      
      <ScreenReaderOnly>
        {percentage}% complete
      </ScreenReaderOnly>
    </div>
  );
});
AccessibleProgress.displayName = "AccessibleProgress";

// Accessible button with loading state
export const AccessibleButton = forwardRef<
  HTMLButtonElement,
  {
    loading?: boolean;
    loadingText?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ 
  children, 
  loading = false, 
  loadingText = "Loading...",
  disabled,
  className,
  ...props 
}, ref) => {
  const isDisabled = disabled || loading;
  
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-describedby={loading ? "button-loading" : undefined}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded",
        "focus:ring-2 focus:ring-blue-500 focus:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            className="opacity-25"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            className="opacity-75"
          />
        </svg>
      )}
      
      <span aria-hidden={loading ? "true" : "false"}>
        {loading ? loadingText : children}
      </span>
      
      {loading && (
        <ScreenReaderOnly id="button-loading">
          {loadingText}
        </ScreenReaderOnly>
      )}
    </button>
  );
});
AccessibleButton.displayName = "AccessibleButton";

// Keyboard navigation helper
export function useKeyboardNavigation(
  items: HTMLElement[],
  orientation: 'horizontal' | 'vertical' = 'vertical'
) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    switch (e.key) {
      case nextKey:
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % items.length);
        break;
      case prevKey:
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setCurrentIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setCurrentIndex(items.length - 1);
        break;
    }
  };

  useEffect(() => {
    items[currentIndex]?.focus();
  }, [currentIndex, items]);

  return { currentIndex, handleKeyDown };
}