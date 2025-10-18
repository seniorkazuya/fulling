#!/bin/bash
# Custom prompt: user@project-name:relative-path

PROJECT_NAME="${PROJECT_NAME:-sandbox}"

# Function to show path relative to /workspace
_path() {
    case "${PWD}" in
        /workspace) echo "/" ;;
        /workspace/*) echo "${PWD#/workspace}" ;;
        *) echo "${PWD}" ;;
    esac
}

# Update prompt on every command
PROMPT_COMMAND='PS1="\u@${PROJECT_NAME}:$(_path)\$ "'

# Auto-start Claude Code CLI when terminal opens
# Only runs in the initial shell, not in subshells
if [ -z "$CLAUDE_AUTO_STARTED" ]; then
    export CLAUDE_AUTO_STARTED=1
    echo "🤖 Starting Claude Code CLI..."
    claude
fi
