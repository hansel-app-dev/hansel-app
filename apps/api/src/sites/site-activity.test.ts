import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  createSiteActivityFeature,
  SiteActivityNotFoundError,
} from './site-activity.js';

const principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  membershipId: '00000000-0000-4000-8000-000000000003',
  roleId: 'viewer',
  email: 'viewer@example.com',
};
const siteId = '00000000-0000-4000-8000-000000000004';
const record = {
  id: '00000000-0000-4000-8000-000000000005',
  kind: 'SIGN_CREATED',
  subjectLabel: 'RS.101',
  commentText: null,
  createdAt: new Date('2026-09-06T00:00:00.000Z'),
  actor: {
    user: {
      email: 'nabin@example.com',
      personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
    },
  },
};
const makePrisma = () => ({
  site: { count: vi.fn().mockResolvedValue(1) },
  activity: {
    findMany: vi.fn().mockResolvedValue([record]),
    create: vi.fn().mockResolvedValue({
      ...record,
      kind: 'SITE_COMMENT_ADDED',
      subjectLabel: null,
      commentText: 'Hello team',
    }),
  },
});

describe('Site Activity persistence [site-activity-feed-comments REQ-002..REQ-010]', () => {
  it('lists canonical Site-scoped Activity and lets a Viewer comment', async () => {
    const prisma = makePrisma();
    const feature = createSiteActivityFeature(
      prisma as unknown as PrismaClient,
    );
    await expect(feature.list(principal, siteId)).resolves.toEqual({
      items: [
        {
          id: record.id,
          kind: 'SIGN_CREATED',
          subjectLabel: 'RS.101',
          actor: { displayName: 'Nabin Singh', initials: 'NS' },
          createdAt: '2026-09-06T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    await expect(
      feature.comment(principal, siteId, 'Hello team'),
    ).resolves.toMatchObject({
      kind: 'SITE_COMMENT_ADDED',
      commentText: 'Hello team',
    });
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: principal.tenantId,
          siteId,
          actorMembershipId: principal.membershipId,
          kind: 'SITE_COMMENT_ADDED',
          commentText: 'Hello team',
        }),
      }),
    );
  });

  it('hides inaccessible Sites and returns an opaque older-page cursor', async () => {
    const missing = makePrisma();
    missing.site.count.mockResolvedValue(0);
    await expect(
      createSiteActivityFeature(missing as unknown as PrismaClient).list(
        principal,
        siteId,
      ),
    ).rejects.toBeInstanceOf(SiteActivityNotFoundError);
    const paged = makePrisma();
    paged.activity.findMany.mockResolvedValue(Array(51).fill(record));
    const page = await createSiteActivityFeature(
      paged as unknown as PrismaClient,
    ).list(principal, siteId);
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toEqual(expect.any(String));
  });
});
it('site-activity-feed-comments REQ-002..010: validates cursor shapes and scopes older pages, tolerating missing display metadata', async () => {
  const db = makePrisma(),
    api = createSiteActivityFeature(db as never);
  for (const value of [
    'invalid',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(
      JSON.stringify({ createdAt: record.createdAt.toISOString() }),
    ).toString('base64url'),
  ])
    await expect(api.list(principal, siteId, value)).rejects.toThrow();
  db.activity.findMany.mockResolvedValue([
    {
      ...record,
      subjectLabel: null,
      actor: { user: { email: 'member@example.com', personalProfile: null } },
    },
  ]);
  const cursor = Buffer.from(
    JSON.stringify({
      id: record.id,
      createdAt: record.createdAt.toISOString(),
    }),
  ).toString('base64url');
  expect(
    (await api.list({ ...principal, roleId: 'owner' }, siteId, cursor))
      .items[0],
  ).toMatchObject({
    actor: { displayName: 'Member', initials: 'M' },
    subjectLabel: '',
  });
  db.activity.findMany.mockResolvedValue([
    {
      ...record,
      kind: 'SITE_COMMENT_ADDED',
      commentText: null,
      actor: {
        user: { email: '', personalProfile: { firstName: '', lastName: '' } },
      },
    },
  ]);
  expect((await api.list(principal, siteId)).items[0]).toMatchObject({
    commentText: '',
    actor: { initials: '' },
  });
});
