#!/bin/bash
# Script to set up the Pulumi stack for the first deployment

# Ensure we're in the infra directory
cd "$(dirname "$0")" || exit

# Create the stack if it doesn't exist
pulumi stack init prod

# Set the cluster name
pulumi config set infra:clusterName homelab

# Prompt for kubeconfig
echo "Please provide the path to your kubeconfig file (default: ~/homelab/admin.conf):"
read -r KUBECONFIG_PATH
KUBECONFIG_PATH=${KUBECONFIG_PATH:-~/homelab/admin.conf}

# Set the kubeconfig
if [ -f "$KUBECONFIG_PATH" ]; then
  echo "Setting kubeconfig from $KUBECONFIG_PATH..."
  
  # Check if PULUMI_CONFIG_PASSPHRASE is set
  if [ -z "${PULUMI_CONFIG_PASSPHRASE+x}" ]; then
    echo "Note: PULUMI_CONFIG_PASSPHRASE environment variable is not set."
    echo "If you're using an empty passphrase, that's fine."
    echo "Make sure to set the same passphrase in your GitHub Actions secrets."
  else
    echo "Using the passphrase from PULUMI_CONFIG_PASSPHRASE environment variable."
  fi
  
  pulumi config set --secret infra:kubeconfig "$(cat "$KUBECONFIG_PATH")"
  
  # Prompt for GitHub credentials
  echo ""
  echo "Now we need to set up GitHub Container Registry credentials."
  echo "Please provide your GitHub username:"
  read -r GITHUB_USERNAME
  
  echo "Please provide your GitHub Personal Access Token (with read:packages scope):"
  read -rs GITHUB_TOKEN
  echo ""
  
  # Set GitHub credentials
  pulumi config set infra:githubUsername "$GITHUB_USERNAME"
  pulumi config set --secret infra:githubToken "$GITHUB_TOKEN"
  
  echo "Pulumi stack configuration has been set up successfully."
  echo "IMPORTANT: Remember to add the PULUMI_CONFIG_PASSPHRASE secret to your GitHub repository with the same value you used here."
else
  echo "Error: Kubeconfig file not found at $KUBECONFIG_PATH."
  exit 1
fi 