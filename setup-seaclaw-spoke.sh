#!/bin/bash

# Setup script for SeaClaw spoke agent on VPS
# This script will SSH to the VPS and set up the spoke agent

set -e

VPS_HOST="187.77.185.88"
VPS_USER="root"
HUB_URL="http://localhost:3001"
COMPANY_ID="3cc6b46b-aa65-42fd-a511-edb3800e9c63"

echo "=========================================="
echo "SeaClaw Spoke Agent Setup"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Copy spoke-agent.sh to VPS"
echo "2. Configure environment variables"
echo "3. Run the spoke agent"
echo ""
echo "VPS: ${VPS_HOST}"
echo "Hub URL: ${HUB_URL}"
echo "Company ID: ${COMPANY_ID}"
echo ""
read -p "Press Enter to continue..."

# Copy the spoke agent script to VPS
echo ""
echo "Copying spoke-agent.sh to VPS..."
scp scripts/spoke-agent.sh ${VPS_USER}@${VPS_HOST}:/root/

# Create a setup script on the VPS
echo ""
echo "Creating setup script on VPS..."
ssh ${VPS_USER}@${VPS_HOST} 'cat > /root/run-spoke-agent.sh << "EOF"
#!/bin/bash

# SeaClaw Spoke Agent Runner
export SEACLIP_HUB_URL="http://localhost:3001"
export SEACLIP_COMPANY_ID="3cc6b46b-aa65-42fd-a511-edb3800e9c63"
export SEACLIP_DEVICE_TYPE="seaclaw-container"

# Make script executable
chmod +x /root/spoke-agent.sh

# Run the spoke agent
/root/spoke-agent.sh
EOF
'

# Make the runner script executable
ssh ${VPS_USER}@${VPS_HOST} 'chmod +x /root/run-spoke-agent.sh'

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To start the spoke agent, SSH to the VPS and run:"
echo ""
echo "  ssh ${VPS_USER}@${VPS_HOST}"
echo "  /root/run-spoke-agent.sh"
echo ""
echo "Or run it in the background:"
echo ""
echo "  ssh ${VPS_USER}@${VPS_HOST} 'nohup /root/run-spoke-agent.sh > /tmp/spoke-agent.log 2>&1 &'"
echo ""
echo "To view logs:"
echo ""
echo "  ssh ${VPS_USER}@${VPS_HOST} 'tail -f /tmp/seaclip-spoke-agent.log'"
echo ""
