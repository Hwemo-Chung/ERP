#!/bin/bash
#
# ERP Logistics - Database Reset Script
# Drops and recreates the database with fresh migrations and seed data
#
# Usage:
#   ./scripts/db-reset.sh           # Reset with confirmation
#   ./scripts/db-reset.sh --force   # Reset without confirmation
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

# Confirm reset
confirm_reset() {
    if [ "${1:-}" != "--force" ]; then
        echo ""
        log_warning "This will DELETE ALL DATA in the database!"
        echo ""
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
        echo
        if [ "$REPLY" != "yes" ]; then
            log_info "Aborted"
            exit 0
        fi
    fi
}

# Reset database
reset_database() {
    log_info "Resetting database..."

    cd "$PROJECT_ROOT"

    # Ensure Docker is running
    if ! docker compose ps --status running 2>/dev/null | grep -q "postgres"; then
        log_info "Starting Docker services..."
        docker compose up -d
        sleep 3
    fi

    # Drop and recreate database
    log_info "Dropping existing database..."
    docker compose exec -T postgres psql -U erp_user -d postgres -c "DROP DATABASE IF EXISTS erp_logistics;" 2>/dev/null || true
    docker compose exec -T postgres psql -U erp_user -d postgres -c "CREATE DATABASE erp_logistics;" 2>/dev/null || true

    log_success "Database recreated"

    # Run migrations
    log_info "Running migrations..."
    pnpm db:migrate

    log_success "Migrations applied"

    # Seed database
    log_info "Seeding database..."
    pnpm db:seed

    log_success "Database seeded"

    echo ""
    log_success "Database reset complete!"
    echo ""
    echo "Login credentials:"
    echo "  Username: admin"
    echo "  Password: admin123!"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics DB Reset"
    echo "=================================="

    confirm_reset "$1"
    reset_database
}

main "$@"
