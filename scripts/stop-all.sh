#!/bin/bash
#
# ERP Logistics - Stop All Services Script
# Stops all running services gracefully
#
# Usage:
#   ./scripts/stop-all.sh           # Stop all services
#   ./scripts/stop-all.sh --keep-db # Stop apps but keep database running
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

# Stop process by PID file
stop_by_pid() {
    local name=$1
    local pid_file="$PROJECT_ROOT/.pids/${name}.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            log_info "Stopping $name (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
            log_success "$name stopped"
        else
            log_warning "$name was not running"
        fi
        rm -f "$pid_file"
    fi
}

# Stop process by port
stop_by_port() {
    local port=$1
    local name=$2

    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_info "Stopping $name on port $port..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        log_success "$name stopped"
    else
        log_warning "$name was not running on port $port"
    fi
}

# Stop Docker services
stop_docker() {
    log_info "Stopping Docker services..."

    cd "$PROJECT_ROOT"

    if docker compose ps --status running 2>/dev/null | grep -q "erp"; then
        docker compose down
        log_success "Docker services stopped"
    else
        log_warning "Docker services were not running"
    fi
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics Stop Script"
    echo "=================================="
    echo ""

    # Stop application servers
    stop_by_pid "api"
    stop_by_pid "web"
    stop_by_pid "mobile"

    # Also try by port in case PID files are missing
    stop_by_port 3000 "API"
    stop_by_port 4300 "Web"
    stop_by_port 4200 "Mobile"

    # Stop Docker unless --keep-db flag is passed
    if [ "${1:-}" != "--keep-db" ]; then
        stop_docker
    else
        log_info "Keeping database running (--keep-db flag)"
    fi

    echo ""
    log_success "All services stopped"
    echo ""
}

main "$@"
