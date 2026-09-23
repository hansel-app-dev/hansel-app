#!/bin/bash
set -euo pipefail
umask 077
[[ $(cat /etc/hansel-sandbox/environment) == sandbox ]] || exit 1
release=$(readlink -f /opt/hansel-sandbox/current)
[[ "$release" =~ ^/opt/hansel-sandbox/releases/[a-f0-9]{40}$ ]] || exit 1
source /etc/hansel-sandbox/address.env
export SANDBOX_ADDRESS
source /etc/hansel-sandbox/backup-target.env
[[ "$BACKUPS_BUCKET" == hansel-sandbox-* ]] || exit 1
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
file="hansel-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file "$release/release.env" -f "$release/compose.yaml" exec -T postgres pg_dump -U hansel -d hansel -Fc > "$scratch/$file"
test -s "$scratch/$file"
docker run --rm --env-file /etc/hansel-sandbox/backup.env -v "$scratch:/backup:ro" amazon/aws-cli:2.34.0 s3 cp "/backup/$file" "s3://$BACKUPS_BUCKET/database/$file" --only-show-errors
printf 'Backup completed: %s\n' "$file"
