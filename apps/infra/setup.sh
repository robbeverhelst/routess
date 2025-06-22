#!/bin/bash

# Pulumi Infrastructure Setup Script
# Sets up the complete infrastructure stack with all necessary configuration

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if pulumi is installed
    if ! command -v pulumi &> /dev/null; then
        log_error "Pulumi CLI is not installed. Please install it first: https://www.pulumi.com/docs/get-started/install/"
        exit 1
    fi
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Please install it first: https://bun.sh/"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    bun install
    log_success "Dependencies installed"
}

# Build TypeScript
build_project() {
    log_info "Building TypeScript..."
    bun run build
    log_success "Build completed"
}

# Create or select Pulumi stack
setup_stack() {
    log_info "Setting up Pulumi stack..."
    
    # Check if stack exists
    if pulumi stack ls --json | grep -q '"name": "prod"'; then
        log_info "Stack 'prod' already exists, selecting it..."
        pulumi stack select prod
    else
        log_info "Creating new stack 'prod'..."
        pulumi stack init prod
    fi
    
    log_success "Stack setup completed"
}

# Configure Pulumi settings
configure_pulumi() {
    log_info "Configuring Pulumi settings..."
    
    # Set cluster name
    pulumi config set clusterName homelab
    
    # Kubeconfig setup
    local default_kubeconfig="$HOME/homelab/admin.conf"
    echo ""
    echo "Kubeconfig Configuration:"
    echo "Default path: $default_kubeconfig"
    read -p "Enter kubeconfig path (press Enter for default): " kubeconfig_path
    kubeconfig_path=${kubeconfig_path:-$default_kubeconfig}
    
    # Expand tilde
    kubeconfig_path="${kubeconfig_path/#\~/$HOME}"
    
    if [ ! -f "$kubeconfig_path" ]; then
        log_error "Kubeconfig file not found at: $kubeconfig_path"
        exit 1
    fi
    
    log_info "Setting kubeconfig from $kubeconfig_path..."
    pulumi config set --secret kubeconfig "$(cat "$kubeconfig_path")"
    
    # GitHub credentials setup
    echo ""
    echo "GitHub Container Registry Configuration:"
    read -p "Enter GitHub username: " github_username
    
    echo "Enter GitHub Personal Access Token (with read:packages scope):"
    echo "(Note: Input will be hidden)"
    read -rs github_token
    echo ""
    
    if [ -z "$github_username" ] || [ -z "$github_token" ]; then
        log_error "GitHub credentials cannot be empty"
        exit 1
    fi
    
    pulumi config set githubUsername "$github_username"
    pulumi config set --secret githubToken "$github_token"
    
    # Optional: PostgreSQL password
    echo ""
    read -p "Enter custom PostgreSQL password (press Enter for default): " postgres_password
    if [ -n "$postgres_password" ]; then
        pulumi config set --secret postgresPassword "$postgres_password"
        log_info "Custom PostgreSQL password set"
    else
        log_warning "Using default PostgreSQL password (change in production!)"
    fi
    
    log_success "Pulumi configuration completed"
}

# Verify configuration
verify_config() {
    log_info "Verifying configuration..."
    
    echo ""
    echo "Current configuration:"
    pulumi config
    
    echo ""
    read -p "Does the configuration look correct? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        log_error "Setup cancelled by user"
        exit 1
    fi
    
    log_success "Configuration verified"
}

# Run preview
run_preview() {
    log_info "Running Pulumi preview..."
    
    echo ""
    echo "This will show you what resources will be created:"
    read -p "Run preview? (Y/n): " run_preview_confirm
    
    if [[ ! $run_preview_confirm =~ ^[Nn]$ ]]; then
        pulumi preview
        echo ""
        log_info "Preview completed. Review the changes above."
        log_warning "If everything looks good, you can run 'bun run deploy' to deploy the infrastructure"
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    log_success "Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review the preview output above"
    echo "2. If everything looks correct, deploy with: bun run deploy"
    echo "3. Add PULUMI_CONFIG_PASSPHRASE to your GitHub repository secrets"
    echo "4. The infrastructure will be available after deployment"
    echo ""
    echo "Available commands:"
    echo "  bun run preview  - Preview changes"
    echo "  bun run deploy   - Deploy infrastructure"
    echo "  bun run refresh  - Refresh state"
    echo "  bun run destroy  - Destroy infrastructure"
}

# Main execution
main() {
    echo ""
    log_info "🚀 Starting Pulumi Infrastructure Setup"
    echo ""
    
    check_prerequisites
    install_dependencies
    build_project
    setup_stack
    configure_pulumi
    verify_config
    run_preview
    show_next_steps
}

# Run main function
main "$@"