#!/bin/bash
#
# ERP Logistics - Development Environment Setup Script
# One-time setup for new developers
#
# Usage:
#   ./scripts/dev-setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Log functions
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

# Check and install Homebrew (macOS only)
check_homebrew() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew &> /dev/null; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        log_success "Homebrew OK"
    fi
}

# Check and install Node.js via nvm
check_node() {
    log_info "Checking Node.js..."

    # Check nvm
    if ! command -v nvm &> /dev/null; then
        # Try to source nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

        if ! command -v nvm &> /dev/null; then
            log_info "Installing nvm..."
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        fi
    fi

    # Install and use correct Node version
    cd "$PROJECT_ROOT"
    if [ -f ".nvmrc" ]; then
        nvm install 2>/dev/null || true
        nvm use
    else
        nvm install 20
        nvm use 20
    fi

    log_success "Node.js $(node --version) OK"
}

# Check and install pnpm
check_pnpm() {
    log_info "Checking pnpm..."

    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm..."
        npm install -g pnpm
    fi

    log_success "pnpm $(pnpm --version) OK"
}

# Check and install Docker
check_docker() {
    log_info "Checking Docker..."

    if ! command -v docker &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "Installing Docker via Homebrew..."
            brew install --cask docker
            log_warning "Please start Docker Desktop manually"
        else
            log_error "Please install Docker manually: https://docs.docker.com/get-docker/"
            exit 1
        fi
    fi

    log_success "Docker OK"
}

# Setup environment file
setup_env() {
    log_info "Setting up environment file..."

    cd "$PROJECT_ROOT"

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success ".env file created from .env.example"
            log_warning "Please review and update .env with your settings"
        else
            log_warning ".env.example not found, skipping .env setup"
        fi
    else
        log_warning ".env file already exists"
    fi
}

# Install project dependencies
install_deps() {
    log_info "Installing project dependencies..."

    cd "$PROJECT_ROOT"
    pnpm install

    log_success "Dependencies installed"
}

# Setup Git hooks
setup_git_hooks() {
    log_info "Setting up Git hooks..."

    cd "$PROJECT_ROOT"

    if [ -f "package.json" ] && grep -q "husky" package.json; then
        pnpm prepare 2>/dev/null || true
        log_success "Git hooks configured"
    else
        log_warning "Husky not found, skipping Git hooks setup"
    fi
}

# Start Docker and setup database
setup_database() {
    log_info "Setting up database..."

    cd "$PROJECT_ROOT"

    # Start Docker services
    docker compose up -d

    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    sleep 5

    # Generate Prisma client and run migrations
    pnpm db:generate
    pnpm db:migrate 2>/dev/null || log_warning "Migrations may already be applied"

    # Seed database
    read -p "Seed database with sample data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pnpm db:seed
        log_success "Database seeded"
    fi

    log_success "Database setup complete"
}

# Make scripts executable
make_executable() {
    log_info "Making scripts executable..."

    chmod +x "$PROJECT_ROOT/scripts/"*.sh
    log_success "Scripts are now executable"
}

# Print success message
print_success() {
    echo ""
    echo "=================================="
    echo "   Setup Complete!"
    echo "=================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start all services:"
    echo "   ./scripts/start-all.sh"
    echo ""
    echo "2. Or start individual services:"
    echo "   pnpm api:dev    # API on localhost:3000"
    echo "   pnpm mobile:dev # Mobile on localhost:4200"
    echo "   pnpm web:dev    # Web on localhost:4300"
    echo ""
    echo "3. Access the application:"
    echo "   http://localhost:4200"
    echo "   Login: admin / admin123!"
    echo ""
    echo "4. View API documentation:"
    echo "   http://localhost:3000/api/docs"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics Dev Setup"
    echo "=================================="
    echo ""
    echo "This script will set up your development environment."
    echo ""
    read -p "Continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi

    check_homebrew
    check_node
    check_pnpm
    check_docker
    setup_env
    install_deps
    setup_git_hooks
    make_executable
    setup_database
    print_success
}

main "$@"
