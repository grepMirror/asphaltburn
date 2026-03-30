#!/bin/bash
# ========================================
# Deployment script for Synology NAS
# ========================================

# ===== CONFIGURATION =====
NAS_USER="mroy"
NAS_IP="192.168.1.57"
NAS_PATH="/home/mroy/asphaltburn"

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

echo "========================================"
echo "[1/3] TRANSFERRING FILES TO NAS"
echo "========================================"
echo ""
echo "Packaging and transferring (excluding node_modules and pycache)..."
echo "This might take a moment depending on your upload speed..."

# Package and transfer directly using tar with excludes
tar --exclude='node_modules' --exclude='__pycache__' --exclude='.git' \
    -czf - backend frontend docker-compose.yml deploy-nas.sh | \
    ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_IP" "mkdir -p $NAS_PATH && cd $NAS_PATH && tar xzf -"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] File transfer failed"
    exit 1
fi

echo "  [OK] Transfer complete"

echo ""
echo "========================================"
echo "[2/3] SETTING PERMISSIONS AND FIXING LINE ENDINGS"
echo "========================================"
echo ""

# Fix line endings and set permissions
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_IP" "sed -i 's/\r$//' $NAS_PATH/deploy-nas.sh && chmod +x $NAS_PATH/deploy-nas.sh"

echo ""
echo "========================================"
echo "[3/3] EXECUTING DEPLOYMENT ON NAS"
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
echo "   Application: http://$NAS_IP:5173"
echo ""
echo "   View logs:"
echo "   ssh $NAS_USER@$NAS_IP"
echo "   cd $NAS_PATH"
echo "   sudo docker-compose -f docker-compose.yml logs -f"
echo ""
echo "========================================"
