#!/bin/bash

# Build whisper.wasm using CMake and Emscripten

echo "Building whisper.wasm with CMake..."

# Activate emsdk
source /Users/galahassa/Dev/voiceflow/emsdk/emsdk_env.sh

# Navigate to whisper.cpp directory
cd /Users/galahassa/Dev/voiceflow/voiceflow-pro/libs/whisper.cpp

# Create build directory
mkdir -p build-wasm
cd build-wasm

# Configure with CMake for Emscripten
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_EXAMPLES=ON \
    -DWHISPER_SDL2=OFF \
    -DWHISPER_NO_METAL=ON \
    -DWHISPER_NO_ACCELERATE=ON

# Build the whisper.wasm example
make -j4 libmain

# Copy the built files
if [ -f "bin/libmain.js" ]; then
    echo "Build successful!"
    echo "Copying files..."
    cp bin/libmain.js /Users/galahassa/Dev/voiceflow/voiceflow-pro/apps/web/public/whisper.js
    cp bin/libmain.wasm /Users/galahassa/Dev/voiceflow/voiceflow-pro/apps/web/public/whisper.wasm 2>/dev/null || true
    echo "Files copied to public directory"
else
    echo "Build failed - libmain.js not found"
    exit 1
fi