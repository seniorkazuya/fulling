#!/bin/bash

# Simple entrypoint for ttyd - minimal configuration that works
# Based on user's successful test

# Get port and interface from environment or use defaults
TTYD_PORT=${TTYD_PORT:-7681}
TTYD_INTERFACE=${TTYD_INTERFACE:-0.0.0.0}

echo "Starting ttyd on $TTYD_INTERFACE:$TTYD_PORT"

# Start ttyd with minimal parameters - exactly like user's successful test
exec ttyd --interface $TTYD_INTERFACE --port $TTYD_PORT /bin/bash