#!/bin/bash
#
# ERP Logistics - Full Stack Startup Script
# Starts all services: Docker, API, Web, Mobile
#
# Usage:
#   ./scripts/start-all.sh          # Start all services
#   ./scripts/start-all.sh --api    # Start only API
#   ./scripts/start-all.sh --web    # Start only Web
#   ./scripts/start-all.sh --mobile # Start only Mobile
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 20.x+"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js version 20+ required. Current: $(node --version)"
        exit 1
    fi
    log_success "Node.js $(node --version) OK"

    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please run: npm install -g pnpm"
        exit 1
    fi
    log_success "pnpm $(pnpm --version) OK"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker Desktop."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    log_success "Docker OK"
}

# Use correct Node.js version
setup_node_version() {
    log_info "Setting up Node.js version..."

    if command -v nvm &> /dev/null; then
        cd "$PROJECT_ROOT"
        if [ -f ".nvmrc" ]; then
            nvm use 2>/dev/null || nvm install
            log_success "Node.js version set from .nvmrc"
        fi
    else
        log_warning "nvm not found. Using system Node.js"
    fi
}

# Start Docker services
start_docker() {
    log_info "Starting Docker services (PostgreSQL, Redis)..."

    cd "$PROJECT_ROOT"

    # Check if containers are already running
    if docker compose ps --status running 2>/dev/null | grep -q "erp"; then
        log_warning "Docker containers already running"
    else
        docker compose up -d

        # Wait for PostgreSQL to be ready
        log_info "Waiting for PostgreSQL to be ready..."
        sleep 3

        for i in {1..30}; do
            if docker compose exec -T postgres pg_isready -U erp_user -d erp_logistics &> /dev/null; then
                log_success "PostgreSQL is ready"
                break
            fi
            if [ $i -eq 30 ]; then
                log_error "PostgreSQL failed to start"
                exit 1
            fi
            sleep 1
        done
    fi

    log_success "Docker services started"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"

    if [ ! -d "node_modules" ]; then
        pnpm install
        log_success "Dependencies installed"
    else
        log_warning "Dependencies already installed"
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database..."

    cd "$PROJECT_ROOT"

    # Generate Prisma client
    pnpm db:generate

    # Run migrations
    pnpm db:migrate 2>/dev/null || log_warning "Migrations may already be applied"

    log_success "Database setup complete"
}

# Start API server
start_api() {
    log_info "Starting API server on port 3000..."

    cd "$PROJECT_ROOT"

    # Check if port is in use
    if lsof -i :3000 &> /dev/null; then
        log_warning "Port 3000 is already in use"
        read -p "Kill existing process? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -ti :3000 | xargs kill -9 2>/dev/null || true
            sleep 1
        else
            return
        fi
    fi

    # Start in background
    nohup pnpm api:dev > logs/api.log 2>&1 &
    API_PID=$!
    echo $API_PID > .pids/api.pid

    # Wait for API to be ready
    log_info "Waiting for API to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health &> /dev/null; then
            log_success "API server started (PID: $API_PID)"
            log_info "API URL: http://localhost:3000"
            log_info "Swagger: http://localhost:3000/api/docs"
            return
        fi
        sleep 1
    done

    log_error "API server failed to start. Check logs/api.log"
}

# Start Web app
start_web() {
    log_info "Starting Web app on port 4300..."

    cd "$PROJECT_ROOT"

    # Check if port is in use
    if lsof -i :4300 &> /dev/null; then
        log_warning "Port 4300 is already in use"
        read -p "Kill existing process? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -ti :4300 | xargs kill -9 2>/dev/null || true
            sleep 1
        else
            return
        fi
    fi

    # Start in background
    nohup pnpm web:dev > logs/web.log 2>&1 &
    WEB_PID=$!
    echo $WEB_PID > .pids/web.pid

    log_success "Web app starting (PID: $WEB_PID)"
    log_info "Web URL: http://localhost:4300 (wait ~30s for build)"
}

# Start Mobile app
start_mobile() {
    log_info "Starting Mobile app on port 4200..."

    cd "$PROJECT_ROOT"

    # Check if port is in use
    if lsof -i :4200 &> /dev/null; then
        log_warning "Port 4200 is already in use"
        read -p "Kill existing process? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -ti :4200 | xargs kill -9 2>/dev/null || true
            sleep 1
        else
            return
        fi
    fi

    # Start in background
    nohup pnpm mobile:dev > logs/mobile.log 2>&1 &
    MOBILE_PID=$!
    echo $MOBILE_PID > .pids/mobile.pid

    log_success "Mobile app starting (PID: $MOBILE_PID)"
    log_info "Mobile URL: http://localhost:4200 (wait ~30s for build)"
}

# Create required directories
create_directories() {
    mkdir -p "$PROJECT_ROOT/logs"

    # Remove .pids if it's a file (not directory)
    if [ -f "$PROJECT_ROOT/.pids" ]; then
        rm "$PROJECT_ROOT/.pids"
    fi
    mkdir -p "$PROJECT_ROOT/.pids"
}

# Print status
print_status() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics - Started"
    echo "=================================="
    echo ""
    echo "Services:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis:      localhost:6379"
    echo "  - API:        http://localhost:3000"
    echo "  - Swagger:    http://localhost:3000/api/docs"
    echo "  - Web:        http://localhost:4300"
    echo "  - Mobile:     http://localhost:4200"
    echo ""
    echo "Login Credentials:"
    echo "  - Username: admin"
    echo "  - Password: admin123!"
    echo ""
    echo "Commands:"
    echo "  - Stop all:  ./scripts/stop-all.sh"
    echo "  - View logs: tail -f logs/*.log"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics Startup Script"
    echo "=================================="
    echo ""

    create_directories
    check_prerequisites
    setup_node_version

    case "${1:-all}" in
        --api)
            start_docker
            install_dependencies
            setup_database
            start_api
            ;;
        --web)
            start_docker
            install_dependencies
            start_web
            ;;
        --mobile)
            start_docker
            install_dependencies
            start_mobile
            ;;
        *)
            start_docker
            install_dependencies
            setup_database
            start_api
            start_web
            start_mobile
            print_status
            ;;
    esac
}

main "$@"
