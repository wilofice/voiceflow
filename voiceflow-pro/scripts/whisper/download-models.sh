#!/bin/bash

# Script to download Whisper models in GGML format
# Models are downloaded from Hugging Face

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
MODELS_DIR="$PROJECT_ROOT/apps/web/public/models"

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"

# Model URLs from Hugging Face
declare -A MODEL_URLS=(
    ["tiny"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
    ["tiny.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin"
    ["base"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
    ["base.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
    ["small"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
    ["small.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
    ["medium"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
    ["medium.en"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin"
    ["large-v1"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin"
    ["large-v2"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin"
    ["large-v3"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
)

# Model sizes for reference
declare -A MODEL_SIZES=(
    ["tiny"]="39 MB"
    ["tiny.en"]="39 MB"
    ["base"]="142 MB"
    ["base.en"]="142 MB"
    ["small"]="466 MB"
    ["small.en"]="466 MB"
    ["medium"]="1.5 GB"
    ["medium.en"]="1.5 GB"
    ["large-v1"]="3.1 GB"
    ["large-v2"]="3.1 GB"
    ["large-v3"]="3.1 GB"
)

# Function to download a model
download_model() {
    local model_name=$1
    local url=${MODEL_URLS[$model_name]}
    local output_file="$MODELS_DIR/ggml-${model_name}.bin"
    
    if [ -z "$url" ]; then
        echo "❌ Unknown model: $model_name"
        return 1
    fi
    
    if [ -f "$output_file" ]; then
        echo "✅ Model already exists: $model_name (${MODEL_SIZES[$model_name]})"
        return 0
    fi
    
    echo "📥 Downloading model: $model_name (${MODEL_SIZES[$model_name]})"
    echo "   URL: $url"
    echo "   Destination: $output_file"
    
    # Download with progress bar
    if command -v curl &> /dev/null; then
        curl -L --progress-bar -o "$output_file" "$url"
    elif command -v wget &> /dev/null; then
        wget --show-progress -O "$output_file" "$url"
    else
        echo "❌ Neither curl nor wget found. Please install one of them."
        return 1
    fi
    
    echo "✅ Downloaded: $model_name"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [model_name|all|web|server]"
    echo ""
    echo "Available models:"
    echo "  tiny      - Tiny model (39 MB) - Fastest, lowest accuracy"
    echo "  tiny.en   - Tiny English-only model (39 MB)"
    echo "  base      - Base model (142 MB) - Good balance"
    echo "  base.en   - Base English-only model (142 MB)"
    echo "  small     - Small model (466 MB) - Better accuracy"
    echo "  small.en  - Small English-only model (466 MB)"
    echo "  medium    - Medium model (1.5 GB) - High accuracy"
    echo "  medium.en - Medium English-only model (1.5 GB)"
    echo "  large-v1  - Large v1 model (3.1 GB) - Highest accuracy"
    echo "  large-v2  - Large v2 model (3.1 GB) - Best overall"
    echo "  large-v3  - Large v3 model (3.1 GB) - Latest version"
    echo ""
    echo "Presets:"
    echo "  web       - Download web-suitable models (tiny, base)"
    echo "  server    - Download server models (small, medium)"
    echo "  all       - Download all models"
    echo ""
    echo "Examples:"
    echo "  $0 tiny           # Download only tiny model"
    echo "  $0 web            # Download tiny and base models"
    echo "  $0 server         # Download small and medium models"
}

# Main script logic
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

case "$1" in
    "all")
        echo "📦 Downloading all models..."
        for model in "${!MODEL_URLS[@]}"; do
            download_model "$model"
        done
        ;;
    "web")
        echo "📦 Downloading web-suitable models..."
        download_model "tiny"
        download_model "tiny.en"
        download_model "base"
        download_model "base.en"
        ;;
    "server")
        echo "📦 Downloading server models..."
        download_model "small"
        download_model "small.en"
        download_model "medium"
        download_model "medium.en"
        ;;
    *)
        download_model "$1"
        ;;
esac

# Create model metadata file
echo "📝 Creating model metadata..."
cat > "$MODELS_DIR/models.json" << EOF
{
  "models": [
    {
      "id": "tiny",
      "name": "Tiny",
      "size": 39321600,
      "sizeFormatted": "39 MB",
      "language": "multilingual",
      "description": "Fastest model, suitable for real-time transcription",
      "accuracy": "~85%",
      "speed": "~32x realtime"
    },
    {
      "id": "tiny.en",
      "name": "Tiny (English)",
      "size": 39321600,
      "sizeFormatted": "39 MB",
      "language": "english",
      "description": "English-only tiny model, slightly better for English",
      "accuracy": "~87%",
      "speed": "~32x realtime"
    },
    {
      "id": "base",
      "name": "Base",
      "size": 148897600,
      "sizeFormatted": "142 MB",
      "language": "multilingual",
      "description": "Good balance of speed and accuracy",
      "accuracy": "~91%",
      "speed": "~16x realtime"
    },
    {
      "id": "base.en",
      "name": "Base (English)",
      "size": 148897600,
      "sizeFormatted": "142 MB",
      "language": "english",
      "description": "English-only base model",
      "accuracy": "~93%",
      "speed": "~16x realtime"
    },
    {
      "id": "small",
      "name": "Small",
      "size": 488380800,
      "sizeFormatted": "466 MB",
      "language": "multilingual",
      "description": "Good accuracy for general use",
      "accuracy": "~94%",
      "speed": "~6x realtime"
    },
    {
      "id": "small.en",
      "name": "Small (English)",
      "size": 488380800,
      "sizeFormatted": "466 MB",
      "language": "english",
      "description": "English-only small model",
      "accuracy": "~95%",
      "speed": "~6x realtime"
    },
    {
      "id": "medium",
      "name": "Medium",
      "size": 1611661312,
      "sizeFormatted": "1.5 GB",
      "language": "multilingual",
      "description": "High accuracy for professional use",
      "accuracy": "~96%",
      "speed": "~2x realtime"
    },
    {
      "id": "medium.en",
      "name": "Medium (English)",
      "size": 1611661312,
      "sizeFormatted": "1.5 GB",
      "language": "english",
      "description": "English-only medium model",
      "accuracy": "~97%",
      "speed": "~2x realtime"
    },
    {
      "id": "large-v3",
      "name": "Large v3",
      "size": 3321675776,
      "sizeFormatted": "3.1 GB",
      "language": "multilingual",
      "description": "Highest accuracy, latest version",
      "accuracy": "~98%",
      "speed": "~1x realtime"
    }
  ]
}
EOF

echo ""
echo "✅ Model download complete!"
echo "📁 Models location: $MODELS_DIR"
echo ""
echo "🔧 Next steps:"
echo "1. Build the WASM module: $SCRIPT_DIR/build-whisper-wasm.sh"
echo "2. The models will be served from: /models/ in your web app"