/**
 * React DevTools Connector
 *
 * This script connects to the standalone React DevTools (running on localhost:8097)
 * instead of relying on browser extensions which don't work well with Electron's contextIsolation.
 */

(function() {
  'use strict';

  // Check if we're in development mode
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isDev) {
    console.log('⏭️  Skipping React DevTools (not in development mode)');
    return;
  }

  console.log('🔌 Connecting to standalone React DevTools (localhost:8097)...');

  // Try to connect to standalone React DevTools
  function connectToDevTools() {
    try {
      const script = document.createElement('script');
      script.src = 'http://localhost:8097';

      script.onload = function() {
        console.log('✅ Connected to React DevTools standalone server!');
        console.log('   Open the React DevTools window to inspect your app');
      };

      script.onerror = function() {
        console.warn('⚠️  Could not connect to React DevTools');
        console.warn('   Make sure the standalone React DevTools is running:');
        console.warn('   npm run react-devtools');
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('❌ Failed to load React DevTools:', error);
    }
  }

  // Connect when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectToDevTools);
  } else {
    connectToDevTools();
  }

})();
