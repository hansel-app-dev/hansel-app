# Lightsail sandbox

Implements `lightsail-sandbox`. The separate entry point creates only `Hansel-sandbox` in Sydney. The production stack, its entry point and its workflow are unchanged. Do not deploy production as part of sandbox setup.

## Architecture and cost

One Ubuntu 24.04 Lightsail `medium_3_2` instance (4 GB, 2 vCPU, 80 GB, US$24/month), attached static IPv4, private uploads bucket and separate private backup bucket. Caddy serves the frontend and proxies API/authentication routes to the existing API container; PostgreSQL is reachable only within the Compose network. Workers run in the existing API process. The public URL is `https://<assigned-static-ip>`; Caddy 2.11.4 requests and automatically renews a Let's Encrypt `shortlived` IP certificate. Its persistent data volume must survive releases. No domain purchase is needed.

Allow approximately US$5–13/month for small backups, uploads and monitoring, excluding tax/email and overages. This is not a cost ceiling. Daily snapshots can accumulate costs based on changed blocks; inspect billing and prune obsolete releases and manual snapshots. Budget notification is optional until an email is provided. Activate the `Project` cost allocation tag and verify that `HanselSandbox` charges appear in Cost Explorer before relying on tag-filtered budget alerts; AWS may take time to populate them. The budget cannot stop spending.

## Provision

Use the current authorized AWS credentials locally for provisioning only. Never copy those credentials to the instance. Generate a dedicated 4096-bit RSA SSH key (Lightsail import requires RSA), protect it with filesystem mode 0600, and import the public key into Lightsail as `hansel-sandbox-ssh` using `--public-key-base64 file:///absolute/path/key.pub` (the CLI expects the OpenSSH text, not an additional base64 encoding). Obtain the operator's public IPv4 and use `/32` as `operatorCidr`; update this rule if the operator IP changes. Never use an unrestricted SSH CIDR.

From the repository root, synthesize with the separate app:

```sh
pnpm --filter @hansel/infra exec cdk synth --app 'pnpm exec tsx bin/sandbox.ts' \
  --context stage=sandbox --context operatorCidr=YOUR_IP/32 \
  --context keyPairName=hansel-sandbox-ssh --output /tmp/hansel-sandbox-cdk
```

Add `--context budgetEmail=YOUR_EMAIL` to enable budget notifications. Review the template, then deploy only that template with AWS CloudFormation to the exact stack name `Hansel-sandbox` using `CAPABILITY_NAMED_IAM`. This does not require the production CDK app or production pipeline. The template outputs the IP and the two bucket names. Bootstrap installs Docker and Compose without any secrets. Wait for cloud-init completion before release activation.

Prefer the authenticated Lightsail `get-instance-access-details` host keys when constructing `known_hosts`. Some new instances return an empty host-key list. For initial trust on a fresh sandbox only, confirm the static IP and its instance attachment through the authenticated AWS API, collect and pin the first SSH host key, then enforce strict checking on every connection. This fallback is trust on first use, not independent cryptographic verification of the host. Never silently replace a known key or disable strict checking during release transfer. Save all private operational files outside the repository.

## Runtime settings

The examples in `deploy/sandbox/.env.example` describe separate root-owned 0600 files under `/etc/hansel-sandbox`. Do not copy that combined example directly as an environment file. Generate fresh database/session/digest secrets. The API's `DB_PASSWORD` must match the PostgreSQL password. Set `ALLOWED_ORIGIN` to the exact assigned HTTPS IP origin. Enable approved sandbox feature flags explicitly. Compose sets HANSEL_DEPLOYMENT_ENVIRONMENT=sandbox so this HTTPS IP sandbox may use the approved dummy plan catalog while NODE_ENV remains production. Production does not set the marker and continues rejecting dummy catalogs. External provider login stays disabled, because current application policy requires the production hostname for it.

The user authorized reuse of the current Resend configuration for sandbox testing. Copy only the Resend key/sender into the protected API configuration; never copy the complete local environment file. No email delivery to third parties is part of deployment verification without authorization.

Create an access key for the stack's `hansel-sandbox-storage` IAM user and install it only in `api.env`. Create a separate access key for `hansel-sandbox-backups` and install it only in `backup.env`. Neither user has provisioning permissions. Key values must not enter logs, shell history, Git, CloudFormation outputs or images. Rotate by creating/installing/testing a second key before deactivating/deleting the former one. The backup user only uploads dumps; use the operator credentials to download a dump for restoration.

`address.env` contains `SANDBOX_ADDRESS=<assigned-ip>` and `backup-target.env` contains `BACKUPS_BUCKET=<backup-bucket>`. These two files are sourced by shell scripts; write only the validated values with no shell expressions. Never install production hostnames or bucket names.

## Build and release

On a build machine with Node 24, pnpm and Docker, after checks and a commit:

```sh
bash deploy/sandbox/build-release.sh sandbox /absolute/path/outside/repository
bash deploy/sandbox/ship-release.sh sandbox STATIC_IP SSH_KEY PINNED_KNOWN_HOSTS /absolute/path/outside/repository/COMMIT_SHA
```

The build uses a clean Git archive, builds Linux amd64 images outside Lightsail and records image content IDs. A sandbox-only image layer regenerates the Prisma client after dependency packaging; the existing production Dockerfile is unchanged. The unmodified API image failed a cold-start smoke test because its packaged client was missing, so production image readiness must be checked separately before any future production release. The release directory is named after the source commit and includes checksums. Transfer uses SSH with strict pinned host checking. Activation checks the sandbox marker and checksums, locks against concurrent releases, starts PostgreSQL, and runs `scripts/migrate.mjs` before replacing API/web services. Migration failures stop activation. Existing additive migration policy applies; no destructive rollback is attempted.

A deployment waits for container health and trusted public HTTPS `/api/health`. If new services fail, activation restores the previous images when available. First-deployment failure leaves the sandbox for diagnosis and is never reported as success. Initial certificate issuance can take a few minutes. Verify the certificate is publicly trusted, never bypass TLS verification as a final check.

## Verify

Check `/api/health`, the root frontend, `/login`, a deep SPA link and an API 404 to confirm routing. Confirm only ports 80/443 and restricted SSH are public. Test login/signup with an authorized test user, upload/download and plan/media rendering; verify no unexpected production API or bucket is contacted. Check background-worker logs without copying user content or credentials. Inspect `docker stats --no-stream`, disk space and Caddy certificate-renewal logs. Passing synthesis does not prove live connectivity, memory adequacy, email delivery or restore success.

## Backups and restore

`ship-release.sh` installs a daily 14:00 UTC systemd timer. `backup.sh` creates a PostgreSQL custom-format dump and uploads it to the separate backup bucket; bucket lifecycle expires dumps after seven days. Automatic Lightsail snapshots run daily at 15:00 UTC. Container logs rotate at 10 MB, retaining three files each.

Check `systemctl status hansel-sandbox-backup.timer`, `systemctl status hansel-sandbox-backup.service`, and `journalctl -u hansel-sandbox-backup.service`. A failed upload fails the job. Execute the backup service once immediately after deployment.

For a restore drill, download a dump with operator credentials to a protected temporary directory. Launch a separate PostgreSQL 16 container with a separate volume and no published ports, create an empty test database, run `pg_restore --exit-on-error --no-owner` into it, then check restored tables and an expected non-sensitive test record. Remove only that drill container/volume afterward. Never restore over the live sandbox during a drill, never use production data, and do not count a snapshot alone as a successful restore check.

## Rollback and teardown

Select a preceding immutable release directory and invoke its `activate.sh` with that directory. Keep schema changes additive and use a forward migration repair when necessary. Preserve database and certificate volumes; never use `docker compose down -v` for routine rollback.

Stack deletion retains the instance, attached static IP and S3 buckets to protect data; they continue to incur costs. Full teardown is a separate explicit operation: archive necessary data, identify resources by stack outputs and `Project=HanselSandbox`, remove runtime keys, delete only sandbox resources and then release the unattached static IP. Never enumerate and delete account-wide resources or invoke the production stack workflow.
