#!/bin/bash
set -euo pipefail
# Run as root on the sandbox only, with an extracted immutable release directory.
[[ $(cat /etc/hansel-sandbox/environment) == sandbox ]] || exit 1
release=$(realpath "${1:?release directory required}")
[[ "$release" =~ ^/opt/hansel-sandbox/releases/[a-f0-9]{40}$ ]] || { echo 'Invalid sandbox release'; exit 1; }
exec 9>/run/hansel-sandbox-release.lock
flock -n 9 || { echo 'A sandbox release is already running'; exit 1; }
cd "$release"
sha256sum --check SHA256SUMS
source /etc/hansel-sandbox/address.env
export SANDBOX_ADDRESS
compose=(docker compose --env-file "$release/release.env" -f "$release/compose.yaml")
docker load -i images.tar.gz
"${compose[@]}" up -d --wait postgres
# This failure must never replace a running API.
"${compose[@]}" run --rm --no-deps api node scripts/migrate.mjs
previous=$(readlink -f /opt/hansel-sandbox/current || true)
if ! "${compose[@]}" up -d --wait --wait-timeout 180 api web; then
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    docker compose --env-file "$previous/release.env" -f "$previous/compose.yaml" up -d --wait api web
  fi
  exit 1
fi
if ! curl --fail --silent --show-error --retry 18 --retry-delay 10 --retry-all-errors --max-time 10 "https://$SANDBOX_ADDRESS/api/health"; then
  echo 'HTTPS health check failed; inspect certificates and service logs.'
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    docker compose --env-file "$previous/release.env" -f "$previous/compose.yaml" up -d --wait api web
  fi
  exit 1
fi
ln -sfn "$release" /opt/hansel-sandbox/current
printf '\nSandbox release active: %s\n' "${release##*/}"
