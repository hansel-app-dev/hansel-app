import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createDashboardSession } from '../src/dashboard/session.js';
import { createPrismaDashboardSessionStore } from '../src/dashboard/prisma-session-store.js';
import { createOnboardingSecurity } from '../src/onboarding/security.js';

export async function seedDashboardSession() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.E2E_DATABASE_URL ??
          'postgresql://hansel:hansel@127.0.0.1:5433/hansel?schema=public',
      },
    },
  });
  const security = createOnboardingSecurity({
    passwordPepper: 'e2e-password-pepper',
    verificationDigestKey: 'e2e-verification-digest-key',
  });
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `dashboard-logout-${id}@example.com`,
      emailVerifiedAt: new Date(),
      personalProfile: {
        create: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Hansel Logout E2E',
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
      memberships: { create: { userId: user.id, roleId: 'owner' } },
    },
  });
  const accessCredential = security.createApplicationCredential();
  const refreshCredential = security.createApplicationCredential();
  const family = await prisma.applicationSessionFamily.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      credentials: {
        create: [
          {
            kind: 'ACCESS',
            credentialDigest:
              security.digestApplicationCredential(accessCredential),
            expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
          },
          {
            kind: 'REFRESH',
            credentialDigest:
              security.digestApplicationCredential(refreshCredential),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
          },
        ],
      },
    },
  });
  const dashboard = createDashboardSession({
    ...createPrismaDashboardSessionStore(prisma, () => undefined),
    createCredential: () => security.createApplicationCredential(),
    digestCredential: (value) => security.digestApplicationCredential(value),
    now: () => new Date(),
    recordEvent: () => undefined,
  });
  const server = await new Promise<Server>((resolve) => {
    const listening = createApp(
      {
        allowedOrigin: 'http://127.0.0.1:5173',
        dashboardEnabled: true,
      },
      undefined,
      undefined,
      dashboard,
    ).listen(0, '127.0.0.1', () => {
      resolve(listening);
    });
  });
  const address = server.address() as AddressInfo;

  return {
    apiUrl: `http://127.0.0.1:${String(address.port)}`,
    accessCredential,
    refreshCredential,
    readFamily: () =>
      prisma.applicationSessionFamily.findUniqueOrThrow({
        where: { id: family.id },
      }),
    disconnect: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        }),
      );
      await prisma.$disconnect();
    },
  };
}
