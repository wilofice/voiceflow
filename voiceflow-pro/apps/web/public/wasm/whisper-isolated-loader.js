// Isolated Whisper WASM Module Loader using iframe
(function(global) {
  'use strict';
  
  // Prevent conflicts by isolating in a namespace
  if (global.WhisperWASM) {
    return; // Already loaded
  }
  
  // Create isolated scope for the WASM module
  var WhisperWASM = {};
  
  // Factory function to create isolated whisper module
  WhisperWASM.create = function() {
    return new Promise(function(resolve, reject) {
      // Create isolated iframe to load WASM module
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox = 'allow-scripts allow-same-origin';
      
      var cleanup = function() {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };
      
      iframe.onload = function() {
        try {
          var iframeWindow = iframe.contentWindow;
          
          // Create script in iframe context
          var script = iframeWindow.document.createElement('script');
          script.src = '/wasm/whisper-new.js';
          
          script.onload = function() {
            try {
              // Get the module from iframe context
              var whisperModule = iframeWindow.Module;
              
              if (!whisperModule) {
                throw new Error('Module not found in iframe');
              }
              
              // Clone the module to main context
              var clonedModule = {
                init: whisperModule.init.bind(whisperModule),
                free: whisperModule.free.bind(whisperModule),
                full_default: whisperModule.full_default.bind(whisperModule),
                print: whisperModule.print,
                printErr: whisperModule.printErr,
                FS_createDataFile: whisperModule.FS_createDataFile.bind(whisperModule),
                onRuntimeInitialized: whisperModule.onRuntimeInitialized,
                calledRun: whisperModule.calledRun,
                HEAPU8: whisperModule.HEAPU8
              };
              
              cleanup();
              resolve(clonedModule);
            } catch (error) {
              cleanup();
              reject(error);
            }
          };
          
          script.onerror = function() {
            cleanup();
            reject(new Error('Failed to load WASM script in iframe'));
          };
          
          iframeWindow.document.head.appendChild(script);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      
      iframe.onerror = function() {
        cleanup();
        reject(new Error('Failed to create iframe'));
      };
      
      // Create empty document in iframe
      document.body.appendChild(iframe);
      iframe.contentDocument.write('<!DOCTYPE html><html><head></head><body></body></html>');
      iframe.contentDocument.close();
    });
  };
  
  // Export to global scope
  global.WhisperWASM = WhisperWASM;
  
})(window);