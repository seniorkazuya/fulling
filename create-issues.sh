#!/bin/bash

# Script to create GitHub issues for v0.1.0 todo list
# Usage: ./create-issues.sh YOUR_GITHUB_TOKEN

if [ $# -eq 0 ]; then
    echo "Usage: $0 YOUR_GITHUB_TOKEN"
    echo "Get your token from: https://github.com/settings/tokens"
    exit 1
fi

TOKEN=$1
REPO="FullstackAgent/FullstackAgent"
API_URL="https://api.github.com/repos/$REPO/issues"

# Function to create an issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"

    echo "Creating issue: $title"

    response=$(curl -s -X POST \
        -H "Authorization: token $TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "$API_URL" \
        -d "{
            \"title\": \"$title\",
            \"body\": \"$body\",
            \"labels\": $labels
        }")

    # Check if issue was created successfully
    if echo "$response" | grep -q '"html_url"'; then
        url=$(echo "$response" | grep -o '"html_url": "[^"]*' | cut -d'"' -f4)
        number=$(echo "$response" | grep -o '"number": [0-9]*' | cut -d':' -f2 | tr -d ' ')
        echo "✅ Issue #$number created: $url"
    else
        echo "❌ Failed to create issue: $title"
        echo "Response: $response"
    fi
    echo ""
}

echo "Creating GitHub issues for v0.1.0 todo list..."
echo "Repository: $REPO"
echo ""

# Issue 1: Network Configuration
create_issue "Network Configuration - Support port creation and CNAME configuration" \
"## Description

Implement network configuration features to support:
- Creating new ports for sandbox environments
- CNAME configuration support for custom domain mapping

## Requirements

- Add UI for network configuration in the platform
- Support dynamic port creation and mapping
- Enable CNAME record configuration for custom domains
- Ensure network configurations are applied correctly in the sandbox

## Acceptance Criteria

- Users can create new ports through the UI
- CNAME configuration works properly for custom domains
- Network settings are persisted and applied to sandbox environments
- Proper validation for port numbers and domain names" \
'["enhancement", "v0.1.0", "networking"]'

# Issue 2: Claude Code Environment Variables
create_issue "Default support for Claude Code environment variables in Sandbox" \
"## Description

Ensure Claude Code related environment variables are supported by default and work correctly in sandbox environments.

## Requirements

- Add default Claude Code environment variables to sandbox initialization
- Ensure sensitive environment variables are displayed in secrets section
- Verify all default environment variables are effective in sandbox runtime

## Acceptance Criteria

- Claude Code environment variables are pre-configured in new sandboxes
- Sensitive variables (API keys, tokens) are properly masked in UI
- Environment variables are accessible within the sandbox runtime
- Default configuration does not require manual user intervention" \
'["enhancement", "v0.1.0", "claude-code", "environment"]'

# Issue 3: Auth Configuration
create_issue "Ensure Auth Configuration settings are effective in sandbox environment" \
"## Description

Verify that authentication configuration settings are properly applied and functional within sandbox environments.

## Requirements

- Test Auth Configuration settings propagation to sandbox
- Ensure OAuth and other auth methods work in sandbox
- Verify auth environment variables are correctly injected

## Acceptance Criteria

- Auth configuration changes are reflected in sandbox immediately
- OAuth flows work correctly within sandbox environment
- Auth-related environment variables are properly set
- No authentication failures due to missing configuration" \
'["enhancement", "v0.1.0", "authentication"]'

# Issue 4: Payment Configuration
create_issue "Payment configuration parameters consistent with Stripe and PayPal" \
"## Description

Implement payment configuration that aligns with Stripe and PayPal API requirements and ensure configurations are effective.

## Requirements

- Design payment configuration UI matching Stripe/PayPal parameters
- Support both Stripe and PayPal payment gateways
- Ensure configuration parameters are correctly applied

## Acceptance Criteria

- Payment configuration UI matches provider requirements
- Both Stripe and PayPal integrations work correctly
- Configuration changes are immediately effective
- Proper validation of payment API keys and settings" \
'["enhancement", "v0.1.0", "payment"]'

# Issue 5: GitHub Association
create_issue "Implement GitHub project association functionality" \
"## Description

Create functionality to associate projects with GitHub repositories with an improved UI experience.

## Requirements

- Design UI for GitHub repository selection/binding
- Support binding to existing GitHub repositories
- Eliminate need for manual Repository Name input
- Integrate with GitHub API for repository listing

## Acceptance Criteria

- Users can browse and select existing GitHub repositories
- No manual repository name input required
- GitHub API integration works seamlessly
- Repository association is persisted and managed correctly" \
'["enhancement", "v0.1.0", "github-integration"]'

# Issue 6: Deployment Functionality
create_issue "Automated deployment to Sealos via GitHub Actions" \
"## Description

Implement deployment functionality that uses GitHub mirror repositories and automatically triggers builds via GitHub Actions to deploy to Sealos.

## Requirements

- Prerequisite: GitHub project association must be complete
- Use GitHub mirror repositories as deployment source
- Auto-generate GitHub Actions workflows in sandbox
- Deploy to Sealos using current kubeconfig

## Acceptance Criteria

- Deployment only works when GitHub is associated
- GitHub Actions workflows are automatically generated
- Build and deployment process is fully automated
- Applications are successfully deployed to Sealos
- Deployment status and logs are accessible to users" \
'["enhancement", "v0.1.0", "deployment", "github-actions"]'

echo "✅ All issues creation process completed!"
echo ""
echo "Note: Some issues may have failed if you don't have proper permissions or token is invalid."
echo "Please check the output above for any errors."