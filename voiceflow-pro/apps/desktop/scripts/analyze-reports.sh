#!/bin/bash

# Script to find and analyze all Markdown and XML reports in the repository
# Sorts by last modified time and helps track completed vs remaining tasks

REPO_ROOT="/Users/galahassa/Dev/voiceflow/voiceflow-pro"
OUTPUT_FILE="/Users/galahassa/Dev/voiceflow/voiceflow-pro/apps/desktop/reports-analysis.md"

echo "# VoiceFlowPro Repository Reports Analysis" > "$OUTPUT_FILE"
echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 📊 Report Discovery" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find all Markdown files
echo "### Markdown Reports (.md)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| # | File | Last Modified | Size |" >> "$OUTPUT_FILE"
echo "|---|------|---------------|------|" >> "$OUTPUT_FILE"

counter=1
find "$REPO_ROOT" -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -exec ls -lt {} + | \
  awk -v repo="$REPO_ROOT" -v counter="$counter" '{
    # Extract file path (last field)
    file = $NF
    # Extract date and time
    date = $6 " " $7 " " $8
    # Extract size
    size = $5
    # Make path relative
    gsub(repo "/", "", file)
    printf "| %d | `%s` | %s | %s |\n", counter++, file, date, size
  }' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"

# Find all XML files
echo "### XML/MindMap Documents (.xml)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| # | File | Last Modified | Size |" >> "$OUTPUT_FILE"
echo "|---|------|---------------|------|" >> "$OUTPUT_FILE"

counter=1
find "$REPO_ROOT" -type f -name "*.xml" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -exec ls -lt {} + | \
  awk -v repo="$REPO_ROOT" -v counter="$counter" '{
    file = $NF
    date = $6 " " $7 " " $8
    size = $5
    gsub(repo "/", "", file)
    printf "| %d | `%s` | %s | %s |\n", counter++, file, date, size
  }' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"

# Get the 10 most recently modified reports
echo "## 🕐 Most Recent Reports (Last 10)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$REPO_ROOT" -type f \( -name "*.md" -o -name "*.xml" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -exec ls -lt {} + | head -10 | \
  awk -v repo="$REPO_ROOT" 'NR > 0 {
    file = $NF
    date = $6 " " $7 " " $8
    gsub(repo "/", "", file)
    printf "- **%s** - `%s`\n", date, file
  }' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## 📝 Report Contents Preview" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "*Processing top 5 most recent reports...*" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Process top 5 most recent reports
file_list=$(find "$REPO_ROOT" -type f \( -name "*.md" -o -name "*.xml" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -exec ls -t {} + | head -5)

count=1
for file in $file_list; do
  rel_path="${file#$REPO_ROOT/}"
  echo "### $count. ${rel_path}" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "**Full Path:** \`$file\`" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"

  # Show first 50 lines of the file
  if [[ $file == *.md ]]; then
    echo "\`\`\`markdown" >> "$OUTPUT_FILE"
    head -50 "$file" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
  else
    echo "\`\`\`xml" >> "$OUTPUT_FILE"
    head -50 "$file" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
  fi

  echo "" >> "$OUTPUT_FILE"
  echo "---" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"

  ((count++))
done

echo "✅ Analysis complete! Results written to: $OUTPUT_FILE"
