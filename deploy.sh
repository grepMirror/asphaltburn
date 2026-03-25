#!/bin/bash
# ========================================
# Deployment script for Synology NAS
# ========================================

# ===== CONFIGURATION =====
NAS_USER="ubuntu"
NAS_IP="192.168.1.57"
NAS_PATH="/home/ubuntu/asphaltburn"

echo ""
echo "========================================"
echo "   DEPLOYMENT TO SYNOLOGY NAS"
echo "========================================"
echo ""
echo "NAS: $NAS_USER@$NAS_IP"
echo "Destination: $NAS_PATH"
echo ""

# Check if SSH is available
if ! command -v ssh &> /dev/null; then
    echo "[ERROR] SSH is not available."
    exit 1
fi

# Check if deploy-nas.sh exists
if [ ! -f "deploy-nas.sh" ]; then
    echo "[ERROR] deploy-nas.sh not found!"
    exit 1
fi

echo ""
echo "========================================"
echo "[1/4] PREPARING FILES"
echo "========================================"
echo ""

# Create temporary directory
TEMP_DIR=$(mktemp -d)
echo "Temporary directory: $TEMP_DIR"

echo "Copying necessary files..."

# Copy files
cp -f package.json package-lock.json Dockerfile docker-compose.nas.yml docker-server.js .dockerignore "$TEMP_DIR/" 2>/dev/null

cp -f vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html "$TEMP_DIR/" 2>/dev/null
cp -f tailwind.config.js postcss.config.js "$TEMP_DIR/" 2>/dev/null
[ -f eslint.config.js ] && cp -f eslint.config.js "$TEMP_DIR/"
cp -f .env "$TEMP_DIR/"

# Copy source directories
echo "Copying source directories..."
cp -rf backend src public "$TEMP_DIR/" 2>/dev/null

# Copy deployment script
cp -f deploy-nas.sh "$TEMP_DIR/" 2>/dev/null

echo "  [OK] Files prepared"

echo ""
echo "========================================"
echo "[2/4] TRANSFERRING TO NAS"
echo "========================================"
echo ""
echo "Transferring files using SSH key authentication..."
echo ""

cd "$TEMP_DIR"
tar czf - . | ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_IP" "cd $NAS_PATH && tar xzf -"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] File transfer failed"
    cd - >/dev/null
    rm -rf "$TEMP_DIR"
    exit 1
fi

cd - >/dev/null
echo "  [OK] Transfer complete"

rm -rf "$TEMP_DIR"

echo ""
echo "========================================"
echo "[3/4] SETTING PERMISSIONS AND FIXING LINE ENDINGS"
echo "========================================"
echo ""

# Fix line endings and set permissions
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_IP" "sed -i 's/\r$//' $NAS_PATH/deploy-nas.sh && chmod +x $NAS_PATH/deploy-nas.sh"

echo ""
echo "========================================"
echo "[4/4] EXECUTING DEPLOYMENT ON NAS"
echo "========================================"
echo ""

ssh -t -o StrictHostKeyChecking=no "$NAS_USER@$NAS_IP" \
"cd $NAS_PATH && ./deploy-nas.sh"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Deployment failed"
    exit 1
fi

echo ""
echo "========================================"
echo "   DEPLOYMENT COMPLETED!"
echo "========================================"
echo ""
echo "   Application: http://$NAS_IP:3000"
echo ""
echo "   View logs:"
echo "   ssh $NAS_USER@$NAS_IP"
echo "   cd $NAS_PATH"
echo "   sudo docker-compose -f docker-compose.yml logs -f"
echo ""
echo "========================================"
