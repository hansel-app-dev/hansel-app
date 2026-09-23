#!/bin/bash
set -euo pipefail
[[ ${1:-} == sandbox ]] || { echo 'Usage: build-release.sh sandbox /absolute/output/directory'; exit 1; }
docker buildx version >/dev/null
export DOCKER_BUILDKIT=1
repo=$(git rev-parse --show-toplevel)
revision=$(git rev-parse HEAD)
output=${2:?absolute output directory required}
[[ "$output" = /* ]] || exit 1
release="$output/$revision"
[[ ! -e "$release" ]] || { echo 'Release directory already exists'; exit 1; }
mkdir -p "$release"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
git -C "$repo" archive "$revision" | tar -x -C "$scratch"
cd "$scratch"
pnpm install --frozen-lockfile
pnpm --filter @hansel/contracts build
VITE_API_URL='' pnpm --filter @hansel/web build
printf 'node_modules\n**/node_modules\n.git\n' > .dockerignore
docker build --platform linux/amd64 -f apps/api/Dockerfile -t "hansel-sandbox-api-base:$revision" .
docker build --platform linux/amd64 -f deploy/sandbox/Dockerfile.api --build-arg "BASE_IMAGE=hansel-sandbox-api-base:$revision" -t "hansel-sandbox-api:$revision" .
docker build --platform linux/amd64 -f deploy/sandbox/Dockerfile.web -t "hansel-sandbox-web:$revision" .
docker save "hansel-sandbox-api:$revision" "hansel-sandbox-web:$revision" | gzip > "$release/images.tar.gz"
cp deploy/sandbox/{compose.yaml,activate.sh,backup.sh,hansel-sandbox-backup.service,hansel-sandbox-backup.timer} "$release/"
# Docker content IDs remain immutable even if a tag is changed later.
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\n' "$(docker image inspect --format '{{.Id}}' "hansel-sandbox-api:$revision")" "$(docker image inspect --format '{{.Id}}' "hansel-sandbox-web:$revision")" > "$release/release.env"
cd "$release"
shasum -a 256 images.tar.gz release.env compose.yaml activate.sh backup.sh > SHA256SUMS
printf 'Release ready: %s\n' "$release"
