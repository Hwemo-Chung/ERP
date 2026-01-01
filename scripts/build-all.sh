#!/bin/bash
#
# ERP Logistics - Build Script
# Builds all applications for production
#
# Usage:
#   ./scripts/build-all.sh           # Build all
#   ./scripts/build-all.sh api       # Build API only
#   ./scripts/build-all.sh web       # Build Web only
#   ./scripts/build-all.sh mobile    # Build Mobile only
#   ./scripts/build-all.sh android   # Build Android APK
#   ./scripts/build-all.sh ios       # Build iOS app
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

# Build API
build_api() {
    log_info "Building API..."

    cd "$PROJECT_ROOT/apps/api"
    pnpm build

    log_success "API build complete"
    log_info "Output: apps/api/dist/"
}

# Build Web
build_web() {
    log_info "Building Web app..."

    cd "$PROJECT_ROOT/apps/web"
    pnpm build

    log_success "Web build complete"
    log_info "Output: apps/web/dist/"
}

# Build Mobile
build_mobile() {
    log_info "Building Mobile app..."

    cd "$PROJECT_ROOT/apps/mobile"
    pnpm build

    log_success "Mobile build complete"
    log_info "Output: apps/mobile/www/"
}

# Build Android APK
build_android() {
    log_info "Building Android APK..."

    cd "$PROJECT_ROOT/apps/mobile"

    # Build web assets
    pnpm build

    # Sync Capacitor
    npx cap sync android

    # Build APK
    cd android
    ./gradlew assembleRelease

    log_success "Android APK build complete"
    log_info "Output: apps/mobile/android/app/build/outputs/apk/release/"
}

# Build iOS
build_ios() {
    log_info "Building iOS app..."

    cd "$PROJECT_ROOT/apps/mobile"

    # Build web assets
    pnpm build

    # Sync Capacitor
    npx cap sync ios

    log_success "iOS sync complete"
    log_info "Open Xcode to complete build: npx cap open ios"
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics Build Script"
    echo "=================================="
    echo ""

    case "${1:-all}" in
        api)
            build_api
            ;;
        web)
            build_web
            ;;
        mobile)
            build_mobile
            ;;
        android)
            build_android
            ;;
        ios)
            build_ios
            ;;
        *)
            build_api
            build_web
            build_mobile
            echo ""
            log_success "All builds complete!"
            ;;
    esac
}

main "$@"
