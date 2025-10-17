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

  // Create a synchronous script that loads BEFORE React
  // This ensures the DevTools backend is ready when React initializes
  const script = document.createElement('script');
  script.src = 'http://localhost:8097';

  // Important: NOT async or defer - we need this to block and load first
  script.async = false;
  script.defer = false;

  script.onload = function() {
    console.log('✅ React DevTools backend loaded!');
    console.log('   The DevTools window should now show your components');
  };

  script.onerror = function() {
    console.warn('⚠️  Could not connect to React DevTools server');
    console.warn('   Make sure it is running: npm run react-devtools');
  };

  // Append immediately - this will block until loaded
  document.head.appendChild(script);

})();
