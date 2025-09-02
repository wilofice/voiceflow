#!/bin/bash

# Build script for custom whisper WASM module with proper transcription output
# Ensure you have Emscripten installed and activated

echo "Building custom Whisper WASM module..."

# Get absolute paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WHISPER_DIR="/Users/galahassa/Dev/voiceflow/voiceflow-pro/libs/whisper.cpp"

cd "$SCRIPT_DIR"

# Check if whisper.cpp exists
if [ ! -d "$WHISPER_DIR" ]; then
    echo "Error: whisper.cpp directory not found at $WHISPER_DIR"
    exit 1
fi

echo "Found whisper.cpp at: $WHISPER_DIR"

# Build command based on whisper.cpp's Makefile
emcc -I "$WHISPER_DIR" \
    -I "$WHISPER_DIR/include" \
    -I "$WHISPER_DIR/ggml/include" \
    "$SCRIPT_DIR/whisper-custom.cpp" \
    "$WHISPER_DIR/ggml/src/ggml.c" \
    "$WHISPER_DIR/ggml/src/ggml-alloc.c" \
    "$WHISPER_DIR/ggml/src/ggml-backend.cpp" \
    "$WHISPER_DIR/ggml/src/ggml-quants.c" \
    "$WHISPER_DIR/src/whisper.cpp" \
    -o whisper-custom.js \
    -O3 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s TOTAL_MEMORY=536870912 \
    -s EXPORTED_FUNCTIONS="['_malloc', '_free']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'FS', 'FS_createDataFile', 'FS_createPath', 'FS_createDevice', 'FS_createLazyFile', 'FS_unlink', 'setValue', 'getValue', 'UTF8ToString', 'stringToUTF8', 'lengthBytesUTF8']" \
    -s SINGLE_FILE=1 \
    -s EXPORT_NAME="whisper_factory" \
    -s MODULARIZE=1 \
    -s ENVIRONMENT="web,worker" \
    -s USE_PTHREADS=0 \
    --bind \
    -msimd128

if [ $? -eq 0 ]; then
    echo "Build successful! Output: whisper-custom.js"
    echo ""
    echo "To use the custom module:"
    echo "1. Replace references to 'whisper.js' with 'whisper-custom.js' in your code"
    echo "2. The module now properly outputs transcription text"
else
    echo "Build failed!"
    exit 1
fi