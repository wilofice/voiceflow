#!/usr/bin/env bash
# Safe helper to extract environment variables from the project's setup_env.sh into apps/api/.env
# Usage: ./generate_env_from_setup.sh

SETUP_FILE="${PWD%/*/*}/setup_env.sh"
OUT_FILE="${PWD}/.env"

if [ ! -f "$SETUP_FILE" ]; then
  echo "setup_env.sh not found at $SETUP_FILE"
  exit 1
fi

# Whitelist variable names you want to export into .env.
# Add any required names here.
WHITELIST=(
  DATABASE_URL
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  NODE_ENV
  PORT
)

# Clear existing .env (but keep file permissions)
> "$OUT_FILE"

# Source setup file in a subshell and print the env. We only capture whitelisted vars.
( source "$SETUP_FILE" >/dev/null 2>&1; 
  for name in "${WHITELIST[@]}"; do
    val="${!name}"
    if [ -n "$val" ]; then
      # Escape existing newlines
      printf "%s=%s\n" "$name" "${val//$/\\n}" >> "$OUT_FILE"
    fi
  done
)

echo "Wrote env vars to $OUT_FILE"
