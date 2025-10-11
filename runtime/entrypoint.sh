#!/bin/bash

# Entrypoint script for Full-Stack Web Runtime
# This script starts ttyd as a daemon for web terminal access

# Configuration with proper defaults for Kubernetes deployment
TTYD_PORT=${TTYD_PORT:-7681}
TTYD_USERNAME=${TTYD_USERNAME:-}
TTYD_PASSWORD=${TTYD_PASSWORD:-}
TTYD_INTERFACE=${TTYD_INTERFACE:-0.0.0.0}
TTYD_BASE_PATH=${TTYD_BASE_PATH:-/}
TTYD_WS_PATH=${TTYD_WS_PATH:-/ws}
TTYD_MAX_CLIENTS=${TTYD_MAX_CLIENTS:-0}
TTYD_READONLY=${TTYD_READONLY:-false}
TTYD_CHECK_ORIGIN=${TTYD_CHECK_ORIGIN:-false}
TTYD_ALLOW_ORIGIN=${TTYD_ALLOW_ORIGIN:-*}

# Build ttyd command with options
TTYD_CMD="ttyd"

# Add interface and port
TTYD_CMD="$TTYD_CMD --interface $TTYD_INTERFACE"
TTYD_CMD="$TTYD_CMD --port $TTYD_PORT"

# Add base path
TTYD_CMD="$TTYD_CMD --base-path $TTYD_BASE_PATH"

# Add WebSocket path (important for proper routing)
TTYD_CMD="$TTYD_CMD --ws-path $TTYD_WS_PATH"

# Add authentication if username and password are provided
if [ -n "$TTYD_USERNAME" ] && [ -n "$TTYD_PASSWORD" ]; then
    TTYD_CMD="$TTYD_CMD --credential $TTYD_USERNAME:$TTYD_PASSWORD"
fi

# Add max clients limit
if [ "$TTYD_MAX_CLIENTS" -gt 0 ]; then
    TTYD_CMD="$TTYD_CMD --max-clients $TTYD_MAX_CLIENTS"
fi

# Add readonly mode if enabled
if [ "$TTYD_READONLY" = "true" ]; then
    TTYD_CMD="$TTYD_CMD --readonly"
fi

# FIXED: Correct logic for check-origin flag
# When TTYD_CHECK_ORIGIN is "false", we DISABLE origin checking
if [ "$TTYD_CHECK_ORIGIN" = "false" ]; then
    TTYD_CMD="$TTYD_CMD --check-origin false"
else
    # When TTYD_CHECK_ORIGIN is "true" or not set, enable origin checking
    TTYD_CMD="$TTYD_CMD --check-origin true"
fi

# Add allow origin (for CORS)
TTYD_CMD="$TTYD_CMD --allow-origin $TTYD_ALLOW_ORIGIN"

# Add additional options for better WebSocket compatibility
TTYD_CMD="$TTYD_CMD --ping-interval 30"

# Function to start ttyd in background
start_ttyd() {
    echo "========================================="
    echo "Starting ttyd web terminal service"
    echo "========================================="
    echo "Configuration:"
    echo "  Port: $TTYD_PORT"
    echo "  Interface: $TTYD_INTERFACE"
    echo "  Base Path: $TTYD_BASE_PATH"
    echo "  WebSocket Path: $TTYD_WS_PATH"
    echo "  Check Origin: $TTYD_CHECK_ORIGIN"
    echo "  Allow Origin: $TTYD_ALLOW_ORIGIN"
    echo "  Max Clients: $TTYD_MAX_CLIENTS"
    echo "  Read Only: $TTYD_READONLY"

    if [ -n "$TTYD_USERNAME" ]; then
        echo "  Authentication: Enabled (Username: $TTYD_USERNAME)"
    else
        echo "  Authentication: Disabled"
        echo "  ⚠️  Warning: No authentication configured. Consider setting TTYD_USERNAME and TTYD_PASSWORD for security."
    fi

    echo "========================================="
    echo "Access URLs:"
    echo "  Web Terminal: http://localhost:$TTYD_PORT$TTYD_BASE_PATH"
    echo "  WebSocket: ws://localhost:$TTYD_PORT$TTYD_WS_PATH"
    echo "========================================="

    # Log the actual command being executed
    echo "Executing: $TTYD_CMD /bin/bash"

    # Start ttyd in background
    $TTYD_CMD /bin/bash &
    TTYD_PID=$!
    echo "✅ ttyd started successfully with PID: $TTYD_PID"
    echo "========================================="
}

# Function to stop ttyd gracefully
stop_ttyd() {
    if [ -n "$TTYD_PID" ]; then
        echo "Stopping ttyd (PID: $TTYD_PID)..."
        kill $TTYD_PID 2>/dev/null
        wait $TTYD_PID 2>/dev/null
        echo "ttyd stopped."
    fi
}

# Function to check if ttyd is running
check_ttyd() {
    if [ -n "$TTYD_PID" ] && kill -0 $TTYD_PID 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Trap signals to ensure clean shutdown
trap stop_ttyd EXIT SIGTERM SIGINT

# Check if ttyd should be disabled
if [ "$DISABLE_TTYD" = "true" ]; then
    echo "ℹ️  ttyd is disabled via DISABLE_TTYD environment variable"
else
    # Start ttyd daemon
    start_ttyd

    # Wait a moment and check if ttyd started successfully
    sleep 2
    if check_ttyd; then
        echo "✅ ttyd is running and ready to accept connections"
    else
        echo "❌ Error: ttyd failed to start. Check the logs above for details."
        exit 1
    fi
fi

# If a command was provided, execute it
if [ $# -gt 0 ]; then
    echo "Executing user command: $@"
    exec "$@"
else
    # If no command provided, start an interactive bash shell
    echo "Starting interactive bash shell..."
    echo "========================================="

    # Keep the container running and restart ttyd if it crashes
    while true; do
        if [ "$DISABLE_TTYD" != "true" ] && ! check_ttyd; then
            echo "⚠️  ttyd has stopped unexpectedly. Restarting..."
            start_ttyd
        fi
        sleep 10
    done &

    # Start interactive shell
    exec /bin/bash
fi