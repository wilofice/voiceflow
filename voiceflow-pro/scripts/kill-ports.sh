#!/bin/bash

# This script kills processes running on specified ports.

PORTS=(3001 3002)

for PORT in "${PORTS[@]}"; do
  echo "Checking for process on port $PORT..."
  # lsof -t -i:<port> returns the PID of the process on that port
  PID=$(lsof -t -i:$PORT)

  if [ -n "$PID" ]; then
    echo "Found process with PID $PID on port $PORT. Killing it..."
    kill -9 $PID
    echo "Process $PID killed."
  else
    echo "No process found on port $PORT."
  fi
done

echo "Finished."
