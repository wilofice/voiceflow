// Wrapper to expose whisper.js factory as a global variable
(function() {
    // Import the whisper.js factory and make it available globally
    if (typeof window !== 'undefined') {
        // Browser environment
        var script = document.createElement('script');
        script.onload = function() {
            // The whisper.js should be available in some form
            // We need to check what's actually exported
            console.log('Whisper module script loaded');
            console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('whisper') || k.toLowerCase().includes('module')));
            
            // Try to find the whisper factory function
            if (typeof Module !== 'undefined') {
                console.log('Found Module global, creating factory wrapper');
                window.whisperFactory = function() {
                    return new Promise((resolve, reject) => {
                        if (Module.onRuntimeInitialized) {
                            Module.onRuntimeInitialized = function() {
                                resolve(Module);
                            };
                        } else {
                            resolve(Module);
                        }
                    });
                };
            } else if (typeof whisper !== 'undefined') {
                window.whisperFactory = whisper;
            } else {
                console.error('Could not find whisper factory function');
            }
        };
        script.src = '/wasm/whisper-bindings.js';
        document.head.appendChild(script);
    }
})();