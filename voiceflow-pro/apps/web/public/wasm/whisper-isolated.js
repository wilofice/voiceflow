// Wrapper to isolate the whisper WASM module and prevent conflicts
(function() {
  // Save any existing Module
  var existingModule = typeof Module !== 'undefined' ? Module : undefined;
  
  // Create isolated Module for whisper
  var WhisperModule = {};
  
  // Load the whisper WASM (this will be injected)
  // INSERT_WHISPER_MODULE_HERE
  
  // Restore original Module if it existed
  if (existingModule !== undefined) {
    Module = existingModule;
  }
  
  // Export WhisperModule globally
  window.WhisperModule = WhisperModule;
})();