#!/bin/bash
#
# ERP Logistics - Test Runner Script
# Runs all tests across API, Web, and Mobile apps
#
# Usage:
#   ./scripts/run-tests.sh           # Run all tests
#   ./scripts/run-tests.sh api       # Run only API tests
#   ./scripts/run-tests.sh web       # Run only Web tests
#   ./scripts/run-tests.sh mobile    # Run only Mobile tests
#   ./scripts/run-tests.sh coverage  # Run all tests with coverage
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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test results storage
API_RESULT=0
WEB_RESULT=0
MOBILE_RESULT=0

# Run API tests
run_api_tests() {
    log_info "Running API tests..."
    echo ""

    cd "$PROJECT_ROOT/apps/api"

    if pnpm test; then
        API_RESULT=1
        log_success "API tests passed"
    else
        log_error "API tests failed"
    fi

    echo ""
}

# Run Web tests
run_web_tests() {
    log_info "Running Web tests..."
    echo ""

    cd "$PROJECT_ROOT/apps/web"

    if pnpm test -- --browsers=ChromeHeadless --watch=false; then
        WEB_RESULT=1
        log_success "Web tests passed"
    else
        log_error "Web tests failed"
    fi

    echo ""
}

# Run Mobile tests
run_mobile_tests() {
    log_info "Running Mobile tests..."
    echo ""

    cd "$PROJECT_ROOT/apps/mobile"

    if pnpm test -- --browsers=ChromeHeadless --watch=false; then
        MOBILE_RESULT=1
        log_success "Mobile tests passed"
    else
        log_error "Mobile tests failed"
    fi

    echo ""
}

# Run all tests with coverage
run_coverage() {
    log_info "Running tests with coverage..."
    echo ""

    cd "$PROJECT_ROOT/apps/api"
    pnpm test -- --coverage

    cd "$PROJECT_ROOT/apps/web"
    pnpm test -- --browsers=ChromeHeadless --watch=false --code-coverage

    cd "$PROJECT_ROOT/apps/mobile"
    pnpm test -- --browsers=ChromeHeadless --watch=false --code-coverage

    echo ""
}

# Print summary
print_summary() {
    echo ""
    echo "=================================="
    echo "        Test Summary"
    echo "=================================="
    echo ""

    if [ $API_RESULT -eq 1 ]; then
        echo -e "  API:    ${GREEN}PASSED${NC}"
    else
        echo -e "  API:    ${RED}FAILED${NC}"
    fi

    if [ $WEB_RESULT -eq 1 ]; then
        echo -e "  Web:    ${GREEN}PASSED${NC}"
    else
        echo -e "  Web:    ${RED}FAILED${NC}"
    fi

    if [ $MOBILE_RESULT -eq 1 ]; then
        echo -e "  Mobile: ${GREEN}PASSED${NC}"
    else
        echo -e "  Mobile: ${RED}FAILED${NC}"
    fi

    echo ""

    # Exit with error if any tests failed
    if [ $API_RESULT -eq 0 ] || [ $WEB_RESULT -eq 0 ] || [ $MOBILE_RESULT -eq 0 ]; then
        log_error "Some tests failed"
        exit 1
    else
        log_success "All tests passed!"
    fi
}

# Main execution
main() {
    echo ""
    echo "=================================="
    echo "   ERP Logistics Test Runner"
    echo "=================================="
    echo ""

    case "${1:-all}" in
        api)
            run_api_tests
            ;;
        web)
            run_web_tests
            ;;
        mobile)
            run_mobile_tests
            ;;
        coverage)
            run_coverage
            ;;
        *)
            run_api_tests
            run_web_tests
            run_mobile_tests
            print_summary
            ;;
    esac
}

main "$@"
