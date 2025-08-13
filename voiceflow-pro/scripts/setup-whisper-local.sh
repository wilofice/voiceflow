#!/bin/bash

# VoiceFlow Pro - Local Whisper.cpp Setup Script
# This script installs and configures whisper.cpp for local server processing

set -e

echo "🎙️ Setting up Whisper.cpp for local processing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WHISPER_DIR="/opt/whisper"
MODELS_DIR="/opt/whisper/models"
BUILD_DIR="/tmp/whisper-build"
WHISPER_REPO="https://github.com/ggerganov/whisper.cpp.git"

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   echo -e "${YELLOW}Running as root. Installation will be system-wide.${NC}"
   INSTALL_DIR="$WHISPER_DIR"
else
   echo -e "${YELLOW}Running as user. Installation will be in home directory.${NC}"
   INSTALL_DIR="$HOME/.local/share/whisper"
   MODELS_DIR="$HOME/.local/share/whisper/models"
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
echo "📋 Checking system requirements..."

# Check for git
if ! command_exists git; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check for make
if ! command_exists make; then
    echo -e "${RED}❌ Make is not installed. Please install build-essential (Ubuntu/Debian) or equivalent.${NC}"
    exit 1
fi

# Check for gcc/g++
if ! command_exists gcc || ! command_exists g++; then
    echo -e "${RED}❌ GCC/G++ is not installed. Please install build-essential (Ubuntu/Debian) or equivalent.${NC}"
    exit 1
fi

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    if command_exists apt; then
        PACKAGE_MANAGER="apt"
    elif command_exists yum; then
        PACKAGE_MANAGER="yum"
    elif command_exists dnf; then
        PACKAGE_MANAGER="dnf"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    if command_exists brew; then
        PACKAGE_MANAGER="brew"
    fi
fi

echo "🖥️  Detected OS: $OS"

# Install dependencies
echo "📦 Installing dependencies..."

case $PACKAGE_MANAGER in
    "apt")
        sudo apt update
        sudo apt install -y build-essential git cmake libopenblas-dev pkg-config
        ;;
    "yum"|"dnf")
        sudo $PACKAGE_MANAGER groupinstall -y "Development Tools"
        sudo $PACKAGE_MANAGER install -y git cmake openblas-devel pkgconfig
        ;;
    "brew")
        brew install git cmake openblas pkg-config
        ;;
    *)
        echo -e "${YELLOW}⚠️  Could not detect package manager. Please ensure you have: build-essential, git, cmake, openblas${NC}"
        ;;
esac

# Create directories
echo "📁 Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "$BUILD_DIR"

# Clone whisper.cpp repository
echo "🔄 Cloning whisper.cpp repository..."
if [ -d "$BUILD_DIR/whisper.cpp" ]; then
    echo "Cleaning existing build directory..."
    rm -rf "$BUILD_DIR/whisper.cpp"
fi

git clone --depth 1 "$WHISPER_REPO" "$BUILD_DIR/whisper.cpp"
cd "$BUILD_DIR/whisper.cpp"

# Build whisper.cpp
echo "🔨 Building whisper.cpp..."

# Check for CUDA support
if command_exists nvcc; then
    echo "🚀 CUDA detected. Building with GPU support..."
    make GGML_CUDA=1
else
    echo "💻 Building with CPU support..."
    make
fi

# Install binaries
echo "📥 Installing binaries..."
cp main "$INSTALL_DIR/whisper"
cp stream "$INSTALL_DIR/whisper-stream" 2>/dev/null || echo "Stream binary not available"

# Make binaries executable
chmod +x "$INSTALL_DIR/whisper"
chmod +x "$INSTALL_DIR/whisper-stream" 2>/dev/null || true

# Download default models
echo "📥 Downloading default Whisper models..."

# Create download script
cat > "$INSTALL_DIR/download-models.sh" << 'EOF'
#!/bin/bash

MODELS_DIR="$1"
if [ -z "$MODELS_DIR" ]; then
    MODELS_DIR="./models"
fi

mkdir -p "$MODELS_DIR"

# Model URLs
declare -A MODEL_URLS=(
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
    local model_name="$1"
    local model_url="${MODEL_URLS[$model_name]}"
    local model_path="$MODELS_DIR/ggml-$model_name.bin"
    
    if [ -f "$model_path" ]; then
        echo "Model $model_name already exists, skipping..."
        return
    fi
    
    echo "Downloading $model_name model..."
    if command -v wget >/dev/null 2>&1; then
        wget -q --show-progress -O "$model_path" "$model_url"
    elif command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar -o "$model_path" "$model_url"
    else
        echo "Error: Neither wget nor curl is available"
        return 1
    fi
    
    echo "✅ Downloaded $model_name model"
}

# Download specified models or defaults
if [ $# -eq 1 ]; then
    # Only models directory specified, download defaults
    download_model "tiny"
    download_model "base"
else
    # Download specified models
    shift # Remove models directory argument
    for model in "$@"; do
        if [[ -n "${MODEL_URLS[$model]}" ]]; then
            download_model "$model"
        else
            echo "Unknown model: $model"
            echo "Available models: ${!MODEL_URLS[@]}"
        fi
    done
fi

echo "🎉 Model download completed!"
EOF

chmod +x "$INSTALL_DIR/download-models.sh"

# Download default models (tiny and base)
echo "📥 Downloading tiny and base models..."
"$INSTALL_DIR/download-models.sh" "$MODELS_DIR" "tiny" "base"

# Create configuration file
echo "⚙️ Creating configuration..."
cat > "$INSTALL_DIR/config.json" << EOF
{
  "install_dir": "$INSTALL_DIR",
  "models_dir": "$MODELS_DIR",
  "binary_path": "$INSTALL_DIR/whisper",
  "stream_binary_path": "$INSTALL_DIR/whisper-stream",
  "default_model": "base",
  "supported_models": [
    "tiny", "tiny.en",
    "base", "base.en", 
    "small", "small.en",
    "medium", "medium.en"
  ],
  "threads": $(nproc),
  "gpu_enabled": $(command_exists nvcc && echo "true" || echo "false"),
  "version": "$(date +%Y%m%d)",
  "installed": "$(date -Iseconds)"
}
EOF

# Add to PATH if not system-wide installation
if [[ $EUID -ne 0 ]]; then
    echo "🔗 Setting up PATH..."
    
    # Add to bashrc
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "$INSTALL_DIR" "$HOME/.bashrc"; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$HOME/.bashrc"
        fi
    fi
    
    # Add to zshrc
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "$INSTALL_DIR" "$HOME/.zshrc"; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$HOME/.zshrc"
        fi
    fi
    
    export PATH="$INSTALL_DIR:$PATH"
fi

# Clean up build directory
echo "🧹 Cleaning up..."
rm -rf "$BUILD_DIR"

# Test installation
echo "🧪 Testing installation..."
if "$INSTALL_DIR/whisper" --help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Whisper.cpp installed successfully!${NC}"
else
    echo -e "${RED}❌ Installation test failed${NC}"
    exit 1
fi

# Print installation summary
echo ""
echo "🎉 Installation Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Installation Directory: $INSTALL_DIR"
echo "📁 Models Directory: $MODELS_DIR"
echo "🔧 Binary Path: $INSTALL_DIR/whisper"
echo "📋 Configuration: $INSTALL_DIR/config.json"
echo "📥 Download Script: $INSTALL_DIR/download-models.sh"
echo ""
echo "🚀 Quick Test:"
echo "  $INSTALL_DIR/whisper --help"
echo ""
echo "📥 Download More Models:"
echo "  $INSTALL_DIR/download-models.sh $MODELS_DIR small medium"
echo ""
echo "🔄 To use whisper from anywhere (user installation):"
echo "  source ~/.bashrc  # or restart your terminal"
echo ""

# Create systemd service file for system installations
if [[ $EUID -eq 0 ]]; then
    echo "🔧 Creating systemd service..."
    cat > /etc/systemd/system/whisper-server.service << EOF
[Unit]
Description=Whisper.cpp Server
After=network.target

[Service]
Type=simple
User=whisper
Group=whisper
WorkingDirectory=$INSTALL_DIR
Environment=MODELS_DIR=$MODELS_DIR
ExecStart=$INSTALL_DIR/whisper-stream --model $MODELS_DIR/ggml-base.bin
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create whisper user
    if ! id "whisper" &>/dev/null; then
        useradd -r -s /bin/false -d "$INSTALL_DIR" whisper
        chown -R whisper:whisper "$INSTALL_DIR" "$MODELS_DIR"
    fi
    
    echo "📋 Systemd service created: /etc/systemd/system/whisper-server.service"
    echo "   Start: sudo systemctl start whisper-server"
    echo "   Enable: sudo systemctl enable whisper-server"
fi

echo -e "${GREEN}🎊 Whisper.cpp setup completed successfully!${NC}"