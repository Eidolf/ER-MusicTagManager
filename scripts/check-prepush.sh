#!/bin/bash

# Pre-Flight Validation System
# Mirrors GitHub Actions locally using 'act' and native linters.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting Pre-Flight Checks...${NC}"

# Navigate to repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1


# 1. Prerequisites Check
echo -e "\n${YELLOW}[1/3] Checking Prerequisites...${NC}"

check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed!${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ $1 found${NC}"
    fi
}

check_tool "docker"
check_tool "act"
check_tool "node"
check_tool "python3"

# 2. Fast Mode: Local Linters
echo -e "\n${YELLOW}[2/3] Running Fast Local Linters...${NC}"

echo -n "   - Frontend (ESLint)... "
cd frontend
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Running 'npm run lint' for details:"
    npm run lint
    exit 1
fi
cd ..

echo -n "   - Backend (Ruff)... "
cd backend
if poetry run ruff check . > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Running 'poetry run ruff check .' for details:"
    poetry run ruff check .
    exit 1
fi
cd ..

# 3. Simulation Mode: Act
echo -e "\n${YELLOW}[3/3] Simulating GitHub Actions (using 'act')...${NC}"
echo "   This may take a minute..."

# Run act to simulate the 'Push' event on the CI Orchestrator workflow
# We use --artifact-server-path /tmp/artifacts to avoid cluttering the workspace
if act push -W .github/workflows/ci-orchestrator.yml > act_output.log 2>&1; then
    echo -e "${GREEN}✅ CI Simulation PASSED${NC}"
else
    echo -e "${RED}❌ CI Simulation FAILED${NC}"
    echo -e "${YELLOW}Last 20 lines of logs:${NC}"
    tail -n 20 act_output.log
    echo -e "\nFull logs available in: act_output.log"
    exit 1
fi

echo -e "\n${GREEN}✨ All Pre-Flight Checks Passed! You are ready to push.${NC}"
