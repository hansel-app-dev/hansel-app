/** @spec dashboard-home REQ-005, REQ-007, REQ-009..REQ-011, REQ-019 */
import type { DashboardResponse } from '@hansel/contracts';

interface ViewerIdentity {
  firstName: string;
  lastName: string;
  roleId: string;
}

interface DashboardSessionDependencies {
  authorizeAccess(input: {
    credentialDigest: string;
    now: Date;
  }): Promise<ViewerIdentity | null>;
  rotateRefresh(input: {
    credentialDigest: string;
    accessCredentialDigest: string;
    refreshCredentialDigest: string;
    now: Date;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }): Promise<
    { status: 'accepted'; viewer: ViewerIdentity } | { status: 'rejected' }
  >;
  createCredential(): string;
  digestCredential(value: string): string;
  now(): Date;
  recordEvent(name: string): void;
}

type DashboardSessionResult = DashboardResponse & {
  applicationSession?: {
    accessCredential: string;
    refreshCredential: string;
  };
};

function viewerFrom(identity: ViewerIdentity): DashboardResponse['viewer'] {
  const firstInitial = Array.from(identity.firstName).slice(0, 1).join('');
  const lastInitial = Array.from(identity.lastName).slice(0, 1).join('');
  const roleLabel =
    identity.roleId === 'owner'
      ? 'Owner'
      : identity.roleId.charAt(0).toUpperCase() + identity.roleId.slice(1);
  return {
    displayName: `${identity.firstName} ${identity.lastName}`,
    initials: `${firstInitial}${lastInitial}`.toLocaleUpperCase(),
    roleLabel,
  };
}

export function createDashboardSession(
  dependencies: DashboardSessionDependencies,
) {
  return {
    async load(input: {
      accessCredential: string | null;
      refreshCredential: string | null;
    }): Promise<DashboardSessionResult | null> {
      const now = dependencies.now();
      const identity = input.accessCredential
        ? await dependencies.authorizeAccess({
            credentialDigest: dependencies.digestCredential(
              input.accessCredential,
            ),
            now,
          })
        : null;
      if (identity) {
        dependencies.recordEvent('dashboard_load_succeeded');
        return { viewer: viewerFrom(identity) };
      }
      if (!input.refreshCredential) return null;
      const accessCredential = dependencies.createCredential();
      const refreshCredential = dependencies.createCredential();
      let rotation: Awaited<
        ReturnType<DashboardSessionDependencies['rotateRefresh']>
      >;
      try {
        rotation = await dependencies.rotateRefresh({
          credentialDigest: dependencies.digestCredential(
            input.refreshCredential,
          ),
          accessCredentialDigest:
            dependencies.digestCredential(accessCredential),
          refreshCredentialDigest:
            dependencies.digestCredential(refreshCredential),
          now,
          accessExpiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
          refreshExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
        });
      } catch (error) {
        dependencies.recordEvent('dashboard_refresh_failed');
        throw error;
      }
      if (rotation.status === 'rejected') {
        dependencies.recordEvent('dashboard_refresh_failed');
        return null;
      }
      dependencies.recordEvent('dashboard_refresh_succeeded');
      return {
        viewer: viewerFrom(rotation.viewer),
        applicationSession: { accessCredential, refreshCredential },
      };
    },
  };
}
