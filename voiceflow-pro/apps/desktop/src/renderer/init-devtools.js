/**
 * Initialize connection to standalone React DevTools
 * This must run BEFORE React imports
 */

// Only in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('🔧 Initializing React DevTools connection...');

  // Set up connection parameters for React DevTools
  window.__REACT_DEVTOOLS_GLOBAL_HOOK_CONNECTION_URL__ = 'ws://localhost:8097';

  // Load the backend script synchronously (blocks until loaded)
  document.write('<script src="http://localhost:8097"><\/script>');

  console.log('✅ React DevTools backend initialized');
}
