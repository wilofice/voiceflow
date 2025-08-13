# VoiceFlow Pro - Whisper.cpp Docker Container
FROM ubuntu:22.04

# Metadata
LABEL maintainer="VoiceFlow Pro Team"
LABEL description="Whisper.cpp server for audio transcription"
LABEL version="1.0.0"

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    pkg-config \
    libopenblas-dev \
    libomp-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create whisper user and directories
RUN useradd -r -s /bin/bash -d /opt/whisper whisper && \
    mkdir -p /opt/whisper/models && \
    mkdir -p /opt/whisper/temp && \
    mkdir -p /opt/whisper/logs

# Set working directory
WORKDIR /tmp

# Clone and build whisper.cpp
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git && \
    cd whisper.cpp && \
    make -j$(nproc) && \
    cp main /opt/whisper/whisper && \
    cp stream /opt/whisper/whisper-stream && \
    cp server /opt/whisper/whisper-server && \
    chmod +x /opt/whisper/whisper* && \
    rm -rf /tmp/whisper.cpp

# Create model download script
RUN cat > /opt/whisper/download-models.sh << 'EOF'
#!/bin/bash
set -e

MODELS_DIR="/opt/whisper/models"

# Model URLs and sizes
declare -A MODELS=(
    ["tiny"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
    ["tiny.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin"
    ["base"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
    ["base.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
    ["small"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
    ["small.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
    ["medium"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
    ["medium.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin"
)

download_model() {
    local model="$1"
    local url="${MODELS[$model]}"
    local path="$MODELS_DIR/ggml-$model.bin"
    
    if [ ! -f "$path" ]; then
        echo "📥 Downloading $model model..."
        wget -q --show-progress -O "$path" "$url"
        echo "✅ Downloaded $model"
    else
        echo "📁 $model model already exists"
    fi
}

# Download requested models or defaults
if [ $# -eq 0 ]; then
    echo "📥 Downloading default models (tiny, base)..."
    download_model "tiny"
    download_model "base"
else
    for model in "$@"; do
        if [[ -n "${MODELS[$model]}" ]]; then
            download_model "$model"
        else
            echo "❌ Unknown model: $model"
            echo "Available: ${!MODELS[@]}"
        fi
    done
fi

chown -R whisper:whisper "$MODELS_DIR"
echo "🎉 Model download completed!"
EOF

RUN chmod +x /opt/whisper/download-models.sh

# Download default models
RUN /opt/whisper/download-models.sh

# Create entrypoint script
RUN cat > /opt/whisper/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

echo "🎙️ Starting Whisper.cpp Server"
echo "📍 Working directory: $(pwd)"
echo "📂 Models directory: ${MODELS_DIR:-/opt/whisper/models}"
echo "🔧 Model: ${WHISPER_MODEL:-base}"
echo "🧵 Threads: ${WHISPER_THREADS:-$(nproc)}"
echo "🌐 Host: ${WHISPER_HOST:-0.0.0.0}"
echo "🔌 Port: ${WHISPER_PORT:-8080}"

# Set default values
export MODELS_DIR="${MODELS_DIR:-/opt/whisper/models}"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_THREADS="${WHISPER_THREADS:-$(nproc)}"
export WHISPER_HOST="${WHISPER_HOST:-0.0.0.0}"
export WHISPER_PORT="${WHISPER_PORT:-8080}"

# Check if model exists
MODEL_PATH="$MODELS_DIR/ggml-$WHISPER_MODEL.bin"
if [ ! -f "$MODEL_PATH" ]; then
    echo "❌ Model not found: $MODEL_PATH"
    echo "📥 Available models:"
    ls -la "$MODELS_DIR"/ | grep "ggml-.*\.bin"
    echo ""
    echo "🔄 Downloading $WHISPER_MODEL model..."
    /opt/whisper/download-models.sh "$WHISPER_MODEL"
fi

echo "🚀 Starting server with model: $MODEL_PATH"

# Start whisper server
exec /opt/whisper/whisper-server \
    --model "$MODEL_PATH" \
    --host "$WHISPER_HOST" \
    --port "$WHISPER_PORT" \
    --threads "$WHISPER_THREADS" \
    "$@"
EOF

RUN chmod +x /opt/whisper/entrypoint.sh

# Create health check script
RUN cat > /opt/whisper/healthcheck.sh << 'EOF'
#!/bin/bash
# Health check for whisper server
set -e

HOST="${WHISPER_HOST:-0.0.0.0}"
PORT="${WHISPER_PORT:-8080}"

# Check if the server is responding
if curl -f -s "http://$HOST:$PORT/health" > /dev/null 2>&1; then
    echo "✅ Whisper server is healthy"
    exit 0
else
    echo "❌ Whisper server is not responding"
    exit 1
fi
EOF

RUN chmod +x /opt/whisper/healthcheck.sh

# Set ownership
RUN chown -R whisper:whisper /opt/whisper

# Switch to whisper user
USER whisper

# Set working directory
WORKDIR /opt/whisper

# Environment variables
ENV MODELS_DIR=/opt/whisper/models
ENV WHISPER_MODEL=base
ENV WHISPER_THREADS=4
ENV WHISPER_HOST=0.0.0.0
ENV WHISPER_PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /opt/whisper/healthcheck.sh

# Use entrypoint
ENTRYPOINT ["/opt/whisper/entrypoint.sh"]

# Default command
CMD []