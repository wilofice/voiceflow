#!/bin/bash

# Build script for compiling whisper.cpp to WebAssembly
# This script builds an optimized WASM version with audio processing support

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
WHISPER_DIR="$PROJECT_ROOT/libs/whisper.cpp"
OUTPUT_DIR="$PROJECT_ROOT/apps/web/public/wasm"

echo "🔨 Building Whisper.cpp WebAssembly module..."

# Check if emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "❌ Emscripten not found. Please install it first:"
    echo "   git clone https://github.com/emscripten-core/emsdk.git"
    echo "   cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    echo "   source ./emsdk_env.sh"
    exit 1
fi

cd "$WHISPER_DIR"

# Build flags optimized for web usage
BUILD_FLAGS=(
    # Optimization flags
    -O3                          # Maximum optimization
    -s WASM=1                    # Build as WASM
    -s ALLOW_MEMORY_GROWTH=1     # Allow memory to grow as needed
    -s MAXIMUM_MEMORY=4GB        # Set max memory (for large models)
    -s INITIAL_MEMORY=256MB      # Initial memory allocation
    
    # Audio processing support
    -s AUDIO_WORKLET=1           # Enable Audio Worklet API
    -s WASM_WORKERS=1            # Enable Web Workers in WASM
    
    # File system support
    -s FORCE_FILESYSTEM=1        # Include file system support
    
    # Export functions
    -s EXPORTED_FUNCTIONS='[
        "_whisper_init_from_buffer",
        "_whisper_init_from_file",
        "_whisper_free",
        "_whisper_full",
        "_whisper_full_parallel",
        "_whisper_full_n_segments",
        "_whisper_full_get_segment_t0",
        "_whisper_full_get_segment_t1",
        "_whisper_full_get_segment_text",
        "_whisper_full_get_segment_speaker",
        "_whisper_full_get_segment_speaker_turn_next",
        "_whisper_pcm_to_mel",
        "_whisper_set_mel",
        "_whisper_encode",
        "_whisper_decode",
        "_whisper_tokenize",
        "_whisper_lang_id",
        "_whisper_lang_str",
        "_whisper_lang_auto_detect",
        "_whisper_n_len",
        "_whisper_n_vocab",
        "_whisper_n_text_ctx",
        "_whisper_n_audio_ctx",
        "_whisper_is_multilingual",
        "_whisper_print_timings",
        "_whisper_reset_timings",
        "_malloc",
        "_free"
    ]'
    
    # Runtime methods
    -s EXPORTED_RUNTIME_METHODS='[
        "ccall",
        "cwrap",
        "FS",
        "setValue",
        "getValue",
        "UTF8ToString",
        "stringToUTF8",
        "lengthBytesUTF8"
    ]'
    
    # Threading support (for parallel processing)
    -pthread
    -s PTHREAD_POOL_SIZE=4
    
    # SIMD support for better performance
    -msimd128
    
    # Debugging (remove in production)
    # -s ASSERTIONS=1
    # -s SAFE_HEAP=1
    # -g
)

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "📦 Compiling whisper.wasm..."

# This command uses Emscripten (emcc) to compile C++ code (whisper.cpp) into JavaScript (or WebAssembly)
# so it can run in a web browser or JavaScript environment.
#
# Here's a breakdown:
#   emcc: The Emscripten C/C++ compiler. It translates C/C++ code into JavaScript or WebAssembly.
#   "${BUILD_FLAGS[@]}": An array of additional build flags (like optimization, defines, etc.) passed to the compiler.
#   -I.: Adds the current directory to the list of directories to search for header files.
#   -I./examples: Adds the ./examples directory to the header search path.
#   whisper.cpp: The main C++ source file to compile.
#   -o "$OUTPUT_DIR/whisper.js": Sets the output file to whisper.js in the specified output directory.
#       This will be the JavaScript "glue" code (and possibly a .wasm file) that allows the compiled C++ code to run in the browser.
#
# Gotcha:
#   - Make sure all dependencies and headers are accessible via the -I flags.
#   - The output will be JavaScript (and possibly WebAssembly), not a native binary.
#
# Summary:
#   This command compiles whisper.cpp for the web using Emscripten, producing JavaScript/WebAssembly output.

# Compile the main whisper library
emcc \
    "${BUILD_FLAGS[@]}" \
    -I. \
    -I./examples \
    whisper.cpp \
    -o "$OUTPUT_DIR/whisper.js"

# Build the stream example (for real-time processing)
# At this point, we are compiling the streaming example (examples/stream/stream.cpp) together with whisper.cpp.
# This produces a separate JavaScript/WebAssembly module (whisper-stream.js/whisper-stream.wasm) that is optimized
# for real-time audio processing scenarios, such as live transcription or streaming audio input.
echo "📦 Compiling whisper-stream.wasm..."
emcc \
    "${BUILD_FLAGS[@]}" \
    -I. \
    -I./examples \
    examples/stream/stream.cpp \
    whisper.cpp \
    -o "$OUTPUT_DIR/whisper-stream.js"

# Create a wrapper module for easier integration
cat > "$OUTPUT_DIR/whisper-module.js" << 'EOF'
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
EOF

# Optimize the generated files
echo "🔧 Optimizing WASM files..."

# Use wasm-opt if available
if command -v wasm-opt &> /dev/null; then
    wasm-opt -O3 --enable-simd "$OUTPUT_DIR/whisper.wasm" -o "$OUTPUT_DIR/whisper.wasm"
    wasm-opt -O3 --enable-simd "$OUTPUT_DIR/whisper-stream.wasm" -o "$OUTPUT_DIR/whisper-stream.wasm"
    echo "✅ WASM files optimized with wasm-opt"
else
    echo "⚠️  wasm-opt not found. Skipping additional optimization."
fi

# Create a simple test page
cat > "$OUTPUT_DIR/test.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Whisper WASM Test</title>
</head>
<body>
    <h1>Whisper WebAssembly Test</h1>
    <button id="initBtn">Initialize Whisper</button>
    <div id="status"></div>

    <script src="whisper.js"></script>
    <script src="whisper-module.js"></script>
    <script>
        const statusDiv = document.getElementById('status');
        const initBtn = document.getElementById('initBtn');

        initBtn.addEventListener('click', async () => {
            statusDiv.textContent = 'Initializing...';
            try {
                const whisper = new WhisperModule();
                await whisper.initialize();
                statusDiv.textContent = '✅ Whisper WASM initialized successfully!';
            } catch (error) {
                statusDiv.textContent = '❌ Error: ' + error.message;
                console.error(error);
            }
        });
    </script>
</body>
</html>
EOF

echo "✅ Build complete! Files generated in: $OUTPUT_DIR"
echo ""
echo "📋 Generated files:"
echo "   - whisper.js (Main module)"
echo "   - whisper.wasm (WebAssembly binary)"
echo "   - whisper-stream.js (Streaming module)"
echo "   - whisper-stream.wasm (Streaming binary)"
echo "   - whisper-module.js (JavaScript wrapper)"
echo "   - test.html (Test page)"
echo ""
echo "🧪 To test, serve the files and open test.html in a browser"
echo "   cd $OUTPUT_DIR && python3 -m http.server 8000"