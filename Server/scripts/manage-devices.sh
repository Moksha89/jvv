#!/bin/bash
# ============================================================
# Device Management Utility Script
# Usage: ./manage-devices.sh [command] [options]
# ============================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo -e "${CYAN}Remote Access Relay - Device Management${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                          List all registered devices"
    echo "  status <device_id>            Get status of a specific device"
    echo "  register <device_id> <token>  Register a new device"
    echo "  delete <device_id>            Delete a device"
    echo "  health                        Check API server health"
    echo ""
    echo "Environment Variables:"
    echo "  API_URL   API server URL (default: http://localhost:3000)"
    echo ""
}

list_devices() {
    echo -e "${CYAN}Registered Devices:${NC}"
    echo ""
    
    response=$(curl -s "${API_URL}/api/devices")
    count=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])" 2>/dev/null || echo "0")
    
    if [ "$count" = "0" ]; then
        echo "  No devices registered."
        return
    fi
    
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data['devices']:
    status = '\033[0;32mONLINE\033[0m' if d['isOnline'] else '\033[0;31mOFFLINE\033[0m'
    print(f\"  {d['deviceId']:15s} {d.get('hostname', 'N/A'):20s} Port: {d['remotePort']:6d}  {status}  Last: {d.get('lastHeartbeat', 'Never')}\")
"
    echo ""
    echo "Total devices: $count"
}

device_status() {
    local device_id="$1"
    
    response=$(curl -s "${API_URL}/api/devices/${device_id}")
    success=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" != "True" ]; then
        echo -e "${RED}Device not found: ${device_id}${NC}"
        return 1
    fi
    
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)['device']
status = '\033[0;32mONLINE\033[0m' if data['isOnline'] else '\033[0;31mOFFLINE\033[0m'
print(f'''
  Device ID:     {data['deviceId']}
  Hostname:      {data.get('hostname', 'N/A')}
  Agent Version: {data.get('agentVersion', 'N/A')}
  OS:            {data.get('osVersion', 'N/A')}
  Remote Port:   {data['remotePort']}
  Status:        {status}
  Last Heartbeat: {data.get('lastHeartbeat', 'Never')}
  Created:       {data.get('createdAt', 'N/A')}
''')
"
}

register_device() {
    local device_id="$1"
    local auth_token="$2"
    local remote_port="${3:-0}"
    
    local body="{\"deviceId\":\"${device_id}\",\"authToken\":\"${auth_token}\"}"
    if [ "$remote_port" != "0" ]; then
        body="{\"deviceId\":\"${device_id}\",\"authToken\":\"${auth_token}\",\"remotePort\":${remote_port}}"
    fi
    
    response=$(curl -s -X POST "${API_URL}/api/devices/register" \
        -H "Content-Type: application/json" \
        -d "$body")
    
    success=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ]; then
        port=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('assignedRemotePort', 'N/A'))" 2>/dev/null)
        echo -e "${GREEN}Device registered successfully${NC}"
        echo "  Device ID:    ${device_id}"
        echo "  Remote Port:  ${port}"
    else
        msg=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
        echo -e "${RED}Registration failed: ${msg}${NC}"
        return 1
    fi
}

delete_device() {
    local device_id="$1"
    
    echo -e "${YELLOW}Deleting device: ${device_id}${NC}"
    read -p "Are you sure? (y/N) " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Cancelled."
        return
    fi
    
    response=$(curl -s -X DELETE "${API_URL}/api/devices/${device_id}")
    success=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ]; then
        echo -e "${GREEN}Device deleted successfully${NC}"
    else
        echo -e "${RED}Failed to delete device${NC}"
        return 1
    fi
}

check_health() {
    response=$(curl -s "${API_URL}/api/health" 2>/dev/null || echo '{"status":"error"}')
    status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', 'error'))" 2>/dev/null)
    
    if [ "$status" = "ok" ]; then
        echo -e "${GREEN}API Server: Healthy${NC}"
        
        # Check FRP server
        if systemctl is-active --quiet frps 2>/dev/null; then
            echo -e "${GREEN}FRP Server: Running${NC}"
        else
            echo -e "${RED}FRP Server: Not Running${NC}"
        fi
    else
        echo -e "${RED}API Server: Not Responding${NC}"
    fi
}

# Main
case "${1:-}" in
    list)
        list_devices
        ;;
    status)
        [ -z "${2:-}" ] && { echo "Usage: $0 status <device_id>"; exit 1; }
        device_status "$2"
        ;;
    register)
        [ -z "${2:-}" ] || [ -z "${3:-}" ] && { echo "Usage: $0 register <device_id> <auth_token> [remote_port]"; exit 1; }
        register_device "$2" "$3" "${4:-0}"
        ;;
    delete)
        [ -z "${2:-}" ] && { echo "Usage: $0 delete <device_id>"; exit 1; }
        delete_device "$2"
        ;;
    health)
        check_health
        ;;
    *)
        usage
        ;;
esac
