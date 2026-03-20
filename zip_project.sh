#!/bin/bash

echo "Creating zip archive..."

# Remove any old archives
rm -f asphalt_burn.zip asphalt_burn.tar.gz

# We use the built-in tar command (standard in bash environments) to create a compressed archive
tar -czf asphalt_burn.tar.gz --exclude='.vscode' --exclude='node_modules' --exclude='__pycache__' --exclude='.git' --exclude='.venv' --exclude='tests' --exclude='dist' --exclude='*.tar.gz' --exclude='*.zip' .

echo ""
echo "Archive created successfully as asphalt_burn.tar.gz!"
