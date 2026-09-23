#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 curl
systemctl enable --now docker
install -d -m 700 /etc/hansel-sandbox
install -d -m 755 /opt/hansel-sandbox/releases
printf 'sandbox\n' > /etc/hansel-sandbox/environment
