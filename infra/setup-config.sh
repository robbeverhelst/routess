#!/bin/bash

# Check if the kubeconfig file exists
if [ ! -f ~/homelab/admin.conf ]; then
  echo "Error: Kubeconfig file not found at ~/homelab/admin.conf"
  exit 1
fi

# Set the GitHub owner (username or organization)
pulumi config set githubOwner RobbeVerhelst

# Set the hostname for the ingress
read -p "Enter the hostname for the ingress (e.g., maps.example.com): " hostname
pulumi config set hostname "$hostname"

# Set the cluster name
pulumi config set clusterName homelab

# Set the kubeconfig (this will be encrypted)
echo "Setting kubeconfig from ~/homelab/admin.conf..."
pulumi config set --secret kubeconfig "$(cat ~/homelab/admin.conf)"

echo "Configuration complete!"
echo "You can now run 'pulumi preview' to see what resources will be created." 