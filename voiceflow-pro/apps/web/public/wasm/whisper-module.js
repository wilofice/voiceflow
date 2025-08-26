// Whisper.cpp WebAssembly Module Wrapper
// This provides a clean interface for the React application

class WhisperModule {
    constructor() {
        this.module = null;
        this.instance = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // Load the WASM module
        this.module = await createWhisperModule({
            locateFile: (path) => {
                if (path.endsWith('.wasm')) {
                    return '/wasm/' + path;
                }
                return path;
            },
            print: (text) => console.log('[Whisper]', text),
            printErr: (text) => console.error('[Whisper Error]', text),
        });

        this.initialized = true;
        console.log('Whisper WASM module initialized');
    }

    // Initialize whisper context from model buffer
    async initFromBuffer(modelBuffer) {
        if (!this.initialized) throw new Error('Module not initialized');

        const modelPtr = this.module._malloc(modelBuffer.byteLength);
        this.module.HEAPU8.set(new Uint8Array(modelBuffer), modelPtr);

        this.instance = this.module.ccall(
            'whisper_init_from_buffer',
            'number',
            ['number', 'number'],
            [modelPtr, modelBuffer.byteLength]
        );

        this.module._free(modelPtr);

        if (!this.instance) {
            throw new Error('Failed to initialize whisper context');
        }

        return this.instance;
    }

    // Process audio data
    async processAudio(audioData, options = {}) {
        if (!this.instance) throw new Error('Whisper not initialized');

        // Convert audio data to the format whisper expects
        const samples = new Float32Array(audioData);
        const samplesPtr = this.module._malloc(samples.length * 4);
        this.module.HEAPF32.set(samples, samplesPtr / 4);

        // Set processing parameters
        const params = this.getDefaultParams();
        Object.assign(params, options);

        // Run whisper
        const result = this.module.ccall(
            'whisper_full',
            'number',
            ['number', 'number', 'number', 'number'],
            [this.instance, params, samplesPtr, samples.length]
        );

        this.module._free(samplesPtr);

        if (result !== 0) {
            throw new Error(`Whisper processing failed with code: ${result}`);
        }

        // Extract results
        return this.extractResults();
    }

    // Extract transcription results
    extractResults() {
        const segments = [];
        const nSegments = this.module.ccall(
            'whisper_full_n_segments',
            'number',
            ['number'],
            [this.instance]
        );

        for (let i = 0; i < nSegments; i++) {
            const text = this.module.ccall(
                'whisper_full_get_segment_text',
                'string',
                ['number', 'number'],
                [this.instance, i]
            );

            const t0 = this.module.ccall(
                'whisper_full_get_segment_t0',
                'number',
                ['number', 'number'],
                [this.instance, i]
            );

            const t1 = this.module.ccall(
                'whisper_full_get_segment_t1',
                'number',
                ['number', 'number'],
                [this.instance, i]
            );

            segments.push({
                text,
                start: t0 / 100, // Convert to seconds
                end: t1 / 100,
            });
        }

        return {
            text: segments.map(s => s.text).join(' '),
            segments
        };
    }

    // Get default parameters
    getDefaultParams() {
        // This would be properly implemented with whisper_full_default_params
        return {
            n_threads: navigator.hardwareConcurrency || 4,
            translate: false,
            language: 'en',
            print_progress: false,
            print_timestamps: true,
        };
    }

    // Clean up
    destroy() {
        if (this.instance) {
            this.module.ccall('whisper_free', null, ['number'], [this.instance]);
            this.instance = null;
        }
    }
}

// Export for use in the application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhisperModule;
}
