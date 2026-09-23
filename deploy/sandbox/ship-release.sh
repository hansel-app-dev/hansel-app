#!/bin/bash
set -euo pipefail
[[ ${1:-} == sandbox ]] || { echo 'Only sandbox is supported'; exit 1; }
address=${2:?AWS sandbox static IPv4 address}
[[ "$address" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
key=${3:?SSH key path}
known_hosts=${4:?AWS-verified known_hosts path}
release=${5:?release directory}
revision=$(basename "$release")
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 1
ssh_args=(-i "$key" -o "UserKnownHostsFile=$known_hosts" -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes)
# Check the server marker before transferring any release.
ssh "${ssh_args[@]}" "ubuntu@$address" 'test "$(sudo cat /etc/hansel-sandbox/environment)" = sandbox'
ssh "${ssh_args[@]}" "ubuntu@$address" "test ! -e /tmp/hansel-sandbox-$revision && mkdir -m 700 /tmp/hansel-sandbox-$revision"
scp "${ssh_args[@]}" "$release/"* "ubuntu@$address:/tmp/hansel-sandbox-$revision/"
ssh "${ssh_args[@]}" "ubuntu@$address" "sudo test ! -e /opt/hansel-sandbox/releases/$revision && sudo mv /tmp/hansel-sandbox-$revision /opt/hansel-sandbox/releases/$revision && sudo chown -R root:root /opt/hansel-sandbox/releases/$revision && sudo bash /opt/hansel-sandbox/releases/$revision/activate.sh /opt/hansel-sandbox/releases/$revision"
ssh "${ssh_args[@]}" "ubuntu@$address" 'sudo cp /opt/hansel-sandbox/current/hansel-sandbox-backup.{service,timer} /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now hansel-sandbox-backup.timer'
