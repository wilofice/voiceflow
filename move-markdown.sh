#!/bin/bash
# filepath: move-markdown.sh

SOURCE_DIR="${1:-.}"
TARGET_DIR="markdown-documents"

mkdir -p "$TARGET_DIR"

cd "$SOURCE_DIR" || exit 1

# List all tracked and untracked (but not ignored) files, filter for .md
git ls-files --cached --others --exclude-standard | grep '\.md$' | while read -r file; do
  basefile=$(basename "$file")
  if [ ! -e "$TARGET_DIR/$basefile" ]; then
    mv "$file" "$TARGET_DIR/"
    echo "Moved: $file"
  else
    echo "Skipped (already exists): $basefile"
  fi
done