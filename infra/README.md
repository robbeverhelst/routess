# Maps Infrastructure

This directory contains the Pulumi infrastructure code to deploy the Maps application to a Kubernetes cluster.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- [Node.js](https://nodejs.org/en/download/)
- Access to a Kubernetes cluster with a valid kubeconfig file
- GitHub Container Registry with the Maps application image

## Configuration

Before deploying, you need to set up the following configuration values:

```bash
# Set the cluster name
pulumi config set clusterName homelab

# Set the kubeconfig (this will be encrypted)
pulumi config set --secret kubeconfig "$(cat ~/homelab/admin.conf)"

# Set GitHub credentials for pulling images from GitHub Container Registry
# You can create a Personal Access Token with 'read:packages' scope at https://github.com/settings/tokens
pulumi config set githubUsername YOUR_GITHUB_USERNAME
pulumi config set --secret githubToken YOUR_GITHUB_TOKEN
```

Alternatively, you can use the provided setup script:

```bash
# Make the script executable
chmod +x setup-stack.sh

# Run the setup script
./setup-stack.sh
```

## Deployment

To deploy the infrastructure:

```bash
# Preview the changes
pulumi preview

# Deploy the changes
pulumi up
```

## Resources Created

This Pulumi program creates the following resources:

- Kubernetes namespace: `maps`
- Kubernetes deployment: `maps-deployment`
- Kubernetes service: `maps-service`

## Accessing the Application

Once deployed, the application will be accessible within the cluster at `maps-service.maps.svc.cluster.local`. 

The public URL for the application will be `maps.robbeverhelst.com`. To expose this service externally, you'll need to configure Cloudflared to point to this Kubernetes service.

## Cloudflared Configuration

After deploying the Kubernetes resources, update your Cloudflared configuration to route traffic from `maps.robbeverhelst.com` to the internal service:

```yaml
# Example Cloudflared configuration
ingress:
  - hostname: maps.robbeverhelst.com
    service: http://maps-service.maps.svc.cluster.local
  - service: http_status:404
```

## Cleanup

To remove all resources:

```bash
pulumi destroy
``` 

## CI/CD Integration

This project includes a GitHub Actions workflow that automatically builds and deploys the application and infrastructure when changes are pushed to the main branch.

### Required GitHub Secrets

To enable the CI/CD pipeline, you need to set up the following secrets in your GitHub repository:

1. `PULUMI_ACCESS_TOKEN`: Your Pulumi access token for authenticating with the Pulumi service.
   - Generate this from the [Pulumi Account Settings](https://app.pulumi.com/account/tokens)

2. `PULUMI_CONFIG_PASSPHRASE`: The passphrase used to encrypt/decrypt sensitive configuration values.
   - This can be any string you choose (even an empty string)
   - You must use the same passphrase that was used when creating the stack locally
   - If you used an empty passphrase locally, set this to an empty string in GitHub

### Initial Stack Setup

Before running the CI/CD pipeline for the first time, you need to create and configure the Pulumi stack:

1. Install the Pulumi CLI locally
2. Navigate to the `infra` directory
3. Run the setup script: `./setup-stack.sh`
4. This will create the stack and set the necessary configuration values

After the initial setup, the CI/CD pipeline will use the `upsert: true` option to work with the existing stack.

### How the CI/CD Pipeline Works

The CI/CD pipeline consists of three main jobs:

1. **Build**: Builds the application using Bun.
2. **Docker**: Builds and pushes a multi-architecture Docker image to GitHub Container Registry.
3. **Deploy**: Deploys the infrastructure using the official Pulumi GitHub Actions integration.

The deployment job only runs on pushes to the main branch, not on pull requests. The Pulumi GitHub Action automatically handles:

- Creating the stack if it doesn't exist (`upsert: true`)
- Running the Pulumi update
- Reporting the status back to GitHub

### Manual Deployment

You can also manually trigger the workflow from the GitHub Actions tab in your repository. 