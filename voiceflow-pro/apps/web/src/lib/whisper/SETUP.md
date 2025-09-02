# Whisper WASM Setup Guide

## Problem
The default whisper.cpp JavaScript binding (`emscripten.cpp`) doesn't output the actual transcription text. It only runs the inference but never calls the functions to retrieve and print the transcribed segments.

## Solution Options

### Option 1: Install Emscripten and Build Custom WASM

1. **Install Emscripten:**
```bash
# Clone the emsdk repo
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Download and install the latest SDK tools
./emsdk install latest

# Make the "latest" SDK active
./emsdk activate latest

# Activate PATH and other environment variables
source ./emsdk_env.sh
```

2. **Build the custom WASM module:**
```bash
cd /Users/galahassa/Dev/voiceflow/voiceflow-pro/apps/web/src/lib/whisper
chmod +x build-whisper-wasm.sh
./build-whisper-wasm.sh
```

3. **Use the custom module:**
Replace references to `whisper.js` with `whisper-custom.js` in your code.

### Option 2: Use Pre-built Whisper WASM with Output

Look for a pre-built whisper.wasm that includes transcription output. Check:
- The whisper.cpp releases page
- The examples/whisper.wasm directory (if built)

### Option 3: Use Alternative Whisper Implementation

Consider using:
- **@xenova/transformers** - Has built-in Whisper support with proper output
- **whisper-web** - Web-optimized Whisper implementation

Example with @xenova/transformers:
```bash
npm install @xenova/transformers
```

```typescript
import { pipeline } from '@xenova/transformers';

const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
const output = await transcriber(audioURL);
console.log(output.text);
```

## Current Workaround

The current code attempts to capture console output, but since the C++ binding doesn't print the transcription, this won't work. You need one of the above solutions to get actual transcription output.