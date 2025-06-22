# Maps Infrastructure

This directory contains the Pulumi infrastructure code to deploy the Maps application to a Kubernetes cluster.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- [Bun](https://bun.sh/) (for package management and building)
- Access to a Kubernetes cluster with a valid kubeconfig file
- GitHub Container Registry access with a Personal Access Token

## Quick Setup

Run the automated setup script that handles everything:

```bash
# Navigate to the infra directory
cd apps/infra

# Run the complete setup (installs deps, builds, configures Pulumi)
bun run setup
```

The setup script will:

1. ✅ Check prerequisites (Pulumi CLI, Bun)
2. 📦 Install dependencies
3. 🔨 Build TypeScript code
4. 🚀 Create/select Pulumi stack
5. ⚙️ Configure all required settings interactively
6. 🔍 Run preview to show planned changes

## Manual Configuration (Alternative)

If you prefer manual configuration:

```bash
# Install dependencies and build
bun install && bun run build

# Create/select stack
pulumi stack init prod  # or pulumi stack select prod

# Configure settings
pulumi config set clusterName homelab
pulumi config set --secret kubeconfig "$(cat ~/homelab/admin.conf)"
pulumi config set githubUsername YOUR_GITHUB_USERNAME
pulumi config set --secret githubToken YOUR_GITHUB_TOKEN
pulumi config set --secret postgresPassword YOUR_POSTGRES_PASSWORD  # optional
```

## Deployment Commands

```bash
# Preview changes
bun run preview

# Deploy infrastructure
bun run deploy

# Refresh state
bun run refresh

# Destroy infrastructure
bun run destroy
```

## Resources Created

This infrastructure creates:

- **Kubernetes Namespace**: `maps`
- **PostgreSQL Database**: Bitnami Helm chart with persistent storage
- **Web Application**: React frontend deployment and service
- **API Application**: NestJS backend deployment and service with database connectivity
- **Secrets**: GitHub Container Registry pull secrets

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │   API Service   │    │   PostgreSQL    │
│   (React)       │───▶│   (NestJS)      │───▶│   (Helm Chart)  │
│   Port: 80      │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Services

- **Web Service**: `maps-web-service.maps.svc.cluster.local:80`
- **API Service**: `maps-api-service.maps.svc.cluster.local:3000`
- **PostgreSQL**: `maps-postgres-postgresql.maps.svc.cluster.local:5432`

## CI/CD Integration

### Required GitHub Secrets

1. **`PULUMI_ACCESS_TOKEN`**: From [Pulumi Account Settings](https://app.pulumi.com/account/tokens)
2. **`PULUMI_CONFIG_PASSPHRASE`**: Encryption passphrase (can be empty string)

### Pipeline Flow

1. **Build**: Compiles applications with Bun
2. **Docker**: Builds and pushes multi-arch images to GHCR
3. **Deploy**: Updates infrastructure with Pulumi

The pipeline automatically:

- ✅ Creates stacks if they don't exist
- 🔄 Handles updates and rollbacks
- 📊 Reports deployment status to GitHub

## Development

```bash
# Lint code
bun run lint

# Type check
bun run check-types

# Build TypeScript
bun run build
```

## Cleanup

```bash
# Remove all infrastructure
bun run destroy
```

## Troubleshooting

### Common Issues

1. **Kubeconfig not found**: Ensure the path is correct and file exists
2. **GitHub token invalid**: Create a new PAT with `read:packages` scope
3. **Pulumi state conflicts**: Run `pulumi refresh` to sync state

### Getting Help

- Check Pulumi logs: `pulumi logs`
- View current config: `pulumi config`
- Stack information: `pulumi stack`
