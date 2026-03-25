#!/bin/bash
# ========================================
# NAS Deployment Script
# This script runs ON the NAS to deploy the application
# ========================================

# Set PATH for Docker commands on Synology
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/syno/bin:$PATH"

# Navigate to project directory
cd /volume1/docker/jetson-management || exit 1

echo ""
echo "========================================"
echo "STOPPING EXISTING CONTAINER"
echo "========================================"
echo ""
docker-compose -f docker-compose.yml down

echo ""
echo "========================================"
echo "BUILDING DOCKER IMAGE"
echo "========================================"
echo ""
echo "This may take 3-5 minutes..."
docker-compose -f docker-compose.yml build

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Docker build failed"
    exit 1
fi

echo ""
echo "========================================"
echo "STARTING CONTAINER"
echo "========================================"
echo ""
docker-compose -f docker-compose.yml up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Container startup failed"
    exit 1
fi

echo ""
echo "========================================"
echo "VERIFYING STATUS"
echo "========================================"
echo ""
sleep 3
docker-compose -f docker-compose.yml ps

echo ""
echo "========================================"
echo "DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "========================================"
echo ""
echo "Application accessible at: http://192.168.1.42:3000"
echo ""
