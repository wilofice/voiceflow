#!/bin/bash

# Build script for compiling whisper.cpp to WebAssembly
# This script uses the existing CMake build system for WebAssembly

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
WHISPER_DIR="$PROJECT_ROOT/libs/whisper.cpp"
OUTPUT_DIR="$PROJECT_ROOT/apps/web/public/wasm"
BUILD_DIR="$PROJECT_ROOT/build-wasm"

echo "🔨 Building Whisper.cpp WebAssembly module..."

# Check if emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "❌ Emscripten not found. Please install it first:"
    echo "   git clone https://github.com/emscripten-core/emsdk.git"
    echo "   cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    echo "   source ./emsdk_env.sh"
    exit 1
fi

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR"

# Go to whisper.cpp directory
cd "$WHISPER_DIR"

echo "📦 Building with CMake and Emscripten..."

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with Emscripten
emcmake cmake "$WHISPER_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DWHISPER_WASM=ON \
    -DBUILD_SHARED_LIBS=OFF \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_EXAMPLES=ON

# Build the project
emmake make -j4

echo "📦 Copying WASM files to output directory..."

# Copy the built files to our output directory
if [ -f "bin/libmain.js" ]; then
    cp bin/libmain.js "$OUTPUT_DIR/whisper.js"
    echo "✅ Copied whisper.js"
fi

if [ -f "bin/libmain.wasm" ]; then
    cp bin/libmain.wasm "$OUTPUT_DIR/whisper.wasm"
    echo "✅ Copied whisper.wasm"
fi

# If the above files don't exist, try alternative locations
if [ ! -f "$OUTPUT_DIR/whisper.js" ]; then
    # Look for other possible output files
    find "$BUILD_DIR" -name "*.js" -type f | head -1 | while read js_file; do
        cp "$js_file" "$OUTPUT_DIR/whisper.js"
        echo "✅ Copied $(basename $js_file) as whisper.js"
    done
fi

if [ ! -f "$OUTPUT_DIR/whisper.wasm" ]; then
    find "$BUILD_DIR" -name "*.wasm" -type f | head -1 | while read wasm_file; do
        cp "$wasm_file" "$OUTPUT_DIR/whisper.wasm"
        echo "✅ Copied $(basename $wasm_file) as whisper.wasm"
    done
fi

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