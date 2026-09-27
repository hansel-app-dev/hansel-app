import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './sites/signage-schedule.js';
import { SiteActivityNotFoundError } from './sites/site-activity.js';
import {
  AllocationPlansNotFoundError,
  AllocationPlansForbiddenError,
  AllocationPlansConflictError,
  AllocationPlanUploadRejectedError,
} from './sites/allocation-plans.js';
const id = '00000000-0000-4000-8000-000000000001',
  origin = 'http://localhost:5173',
  date = '2026-09-01T00:00:00Z';
const config = {
  allowedOrigin: origin,
  sitesEnabled: true,
  allocationPlansEnabled: true,
  allocationPlanDraftsEnabled: true,
  allocationPlanSignsEnabled: true,
  signageScheduleEnabled: true,
  siteActivityEnabled: true,
};
const area = {
  id,
  fileId: null,
  x: 0.2,
  y: 0.2,
  width: 0.2,
  height: 0.2,
  code: 'Ar.01',
  content: '',
  orientation: 'left',
  type: 'Floor',
  function: 'Environmental',
  colour: 'Blue',
  updatedAt: date,
};
const sign = {
  id,
  fileId: null,
  x: 0.2,
  y: 0.2,
  code: 'SG.001',
  content: '',
  orientation: 'left',
  mounting: 'Wall-mounted',
  function: 'Directional',
  colour: 'Red',
  updatedAt: date,
};
it('allocation-plan-signs/allocation-plan-add-area REQ-001,004,007..012: app dispatch validates requests and scoped service outcomes', async () => {
  for (const kind of ['areas', 'signs'] as const) {
    const row = kind === 'areas' ? area : sign;
    const f = {
      load: vi
        .fn()
        .mockResolvedValue(
          kind === 'areas'
            ? { canManageAreas: true, areas: [row] }
            : { canManageSigns: true, signs: [row] },
        ),
      create: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      remove: vi.fn().mockResolvedValue(true),
    };
    const sites = {
      listSites: vi.fn(),
      createSite: vi.fn(),
      loadSite: vi.fn(),
      recordEvent: vi.fn(),
      [kind === 'areas' ? 'planAreas' : 'planSigns']: f,
    };
    const app = createApp(
        config,
        undefined,
        undefined,
        undefined,
        undefined,
        sites as never,
      ),
      base = `/api/sites/${id}/allocation-plans/${id}/${kind}`;
    const call = (
      method: 'get' | 'post' | 'patch' | 'delete' | 'put',
      suffix = '',
      body: object = {},
    ) =>
      request(app)
        [method](base + suffix)
        .set('Cookie', 'hansel_access=test')
        .set('Origin', origin)
        .send(body);
    await call('get').expect(200);
    await call('get', '?fileId=' + id).expect(200);
    await call('get', '?fileId=bad').expect(400);
    await request(app).get(base).expect(401);
    await request(app)
      .get(base.replace(id, 'bad'))
      .set('Cookie', 'hansel_access=test')
      .expect(400);
    await request(app)
      .get(base.replace('/allocation-plans/' + id, '/allocation-plans/bad'))
      .set('Cookie', 'hansel_access=test')
      .expect(400);
    await request(app)
      .post(base)
      .set('Cookie', 'hansel_access=test')
      .expect(403);
    const draft = {
      fileId: null,
      x: 0.2,
      y: 0.2,
      idempotencyKey: id,
      ...(kind === 'areas' ? { width: 0.2, height: 0.2 } : {}),
    };
    await call('post', '', draft).expect(201);
    await call('post').expect(400);
    await call('patch', '/' + id, {
      code: 'New',
      expectedUpdatedAt: date,
    }).expect(200);
    await call('patch', '/' + id).expect(400);
    await call('delete', '/' + id, { expectedUpdatedAt: date }).expect(200);
    await call('delete', '/' + id).expect(400);
    await call('put').expect(405);
    await call('patch', '/bad').expect(405);
    await call('get', '/' + id).expect(405);
    for (const [method, suffix, body, fn] of [
      ['get', '', {}, f.load],
      ['post', '', draft, f.create],
      ['patch', '/' + id, { code: 'New', expectedUpdatedAt: date }, f.update],
      ['delete', '/' + id, { expectedUpdatedAt: date }, f.remove],
    ] as const) {
      fn.mockResolvedValueOnce(null);
      await call(method, suffix, body).expect(401);
    }
    for (const [error, status] of [
      [new SignageForbiddenError(), 403],
      [new SignageNotFoundError(), 404],
      [new SignageConflictError(), 409],
      [new Error('offline'), 503],
    ] as const) {
      f.load.mockRejectedValueOnce(error);
      await call('get').expect(status);
    }
  }
});
it('site-activity-feed-comments REQ-007..010: validates reads and comments and maps inaccessible or unavailable results', async () => {
  const item = {
    id,
    kind: 'SITE_COMMENT_ADDED',
    commentText: 'Hello',
    actor: { displayName: 'Owner', initials: 'O' },
    createdAt: date,
  };
  const sites = {
    listSites: vi.fn(),
    createSite: vi.fn(),
    loadSite: vi.fn(),
    listSiteActivity: vi
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null }),
    createSiteComment: vi.fn().mockResolvedValue(item),
    recordEvent: vi.fn(),
  };
  const app = createApp(
      config,
      undefined,
      undefined,
      undefined,
      undefined,
      sites as never,
    ),
    base = `/api/sites/${id}`;
  for (const method of ['get', 'post'] as const) {
    const fn =
        method === 'get' ? sites.listSiteActivity : sites.createSiteComment,
      suffix = method === 'get' ? '/activity' : '/comments';
    const call = (path = base, body: object = { text: 'Hello' }) =>
      request(app)
        [method](path + suffix)
        .set('Cookie', 'hansel_access=test')
        .set('Origin', origin)
        .send(body);
    await call().expect(method === 'get' ? 200 : 201);
    await call(base.replace(id, 'bad')).expect(400);
    await request(app)
      [method](base + suffix)
      .set('Origin', origin)
      .send({ text: 'Hello' })
      .expect(401);
    fn.mockResolvedValueOnce(null);
    await call().expect(401);
    fn.mockRejectedValueOnce(new SiteActivityNotFoundError());
    await call().expect(404);
    fn.mockRejectedValueOnce(new Error('offline'));
    await call().expect(503);
  }
  for (const cursor of ['', 'a'.repeat(513)])
    await request(app)
      .get(base + '/activity')
      .query({ cursor })
      .expect(400);
  await request(app)
    .get(base + '/activity')
    .query({ cursor: ['a', 'b'] })
    .expect(400);
  await request(app)
    .post(base + '/comments')
    .set('Origin', origin)
    .send({})
    .expect(400);
  await request(app)
    .post(base + '/comments')
    .send({ text: 'Hello' })
    .expect(403);
});
it('allocation-plan-multiple-files REQ-001,008..010: validates draft creation, verification and commit with categorical failures', async () => {
  const plan = {
    id,
    filename: 'file.png',
    mediaType: 'image/png',
    byteSize: 8,
    createdAt: date,
    modifiedAt: date,
    uploadedBy: 'Owner',
  };
  const sites = {
    listSites: vi.fn(),
    createSite: vi.fn(),
    loadSite: vi.fn(),
    createAllocationPlanDraft: vi.fn().mockResolvedValue({
      uploads: [
        {
          uploadId: id,
          uploadUrl: 'https://upload.example',
          headers: {
            'content-type': 'image/png',
            'x-amz-checksum-sha256': 'a'.repeat(43) + '=',
          },
          expiresAt: date,
        },
      ],
    }),
    verifyAllocationPlanDraft: vi
      .fn()
      .mockResolvedValue({ uploadId: id, verified: true }),
    commitAllocationPlanDraft: vi.fn().mockResolvedValue({ plan }),
    recordEvent: vi.fn(),
  };
  const app = createApp(
      config,
      undefined,
      undefined,
      undefined,
      undefined,
      sites as never,
    ),
    base = `/api/sites/${id}/allocation-plan-drafts`;
  const inputs = [
    [
      '',
      {
        idempotencyKey: 'a'.repeat(32),
        files: [
          {
            filename: 'file.png',
            mediaType: 'image/png',
            byteSize: 8,
            checksumSha256: 'a'.repeat(43) + '=',
          },
        ],
      },
      sites.createAllocationPlanDraft,
    ],
    ['/' + id + '/verify', {}, sites.verifyAllocationPlanDraft],
    [
      '/commit',
      { idempotencyKey: 'a'.repeat(32), name: 'Plan', uploadIds: [id] },
      sites.commitAllocationPlanDraft,
    ],
  ] as const;
  for (const [suffix, input, fn] of inputs) {
    const call = (path = base, body: object = input) =>
      request(app)
        .post(path + suffix)
        .set('Cookie', 'hansel_access=test')
        .set('Origin', origin)
        .send(body);
    await call().expect(suffix === '/' + id + '/verify' ? 200 : 201);
    await call(base.replace(id, 'bad')).expect(400);
    await request(app)
      .post(base + suffix)
      .set('Origin', origin)
      .send(input)
      .expect(401);
    await request(app)
      .post(base + suffix)
      .set('Cookie', 'hansel_access=test')
      .send(input)
      .expect(403);
    fn.mockResolvedValueOnce(null);
    await call().expect(401);
    for (const [error, status] of [
      [new AllocationPlansNotFoundError(), 404],
      [new AllocationPlansForbiddenError(), 403],
      [new AllocationPlansConflictError(), 409],
      [new AllocationPlanUploadRejectedError(), 409],
      [new Error('offline'), 503],
    ] as const) {
      fn.mockRejectedValueOnce(error);
      await call().expect(status);
    }
    if (suffix !== '/' + id + '/verify') await call(base, {}).expect(400);
  }
  await request(app)
    .post(base + '/bad/verify')
    .set('Origin', origin)
    .set('Cookie', 'hansel_access=test')
    .expect(400);
});
it('microsoft-local-auth REQ-004..008: app registers pending email verification and writes continuation cookies', async () => {
  const signup = {
    read: vi.fn().mockResolvedValue({
      email: 'owner@example.com',
      sent: true,
      resendAfter: 0,
    }),
    send: vi.fn().mockResolvedValue('sent'),
    verify: vi.fn().mockResolvedValue({
      destination: '/onboarding/about-you',
      onboardingCredential: 'credential',
    }),
    start: vi.fn(),
    cleanup: vi.fn(),
  };
  const auth = {
    login: vi.fn(),
    enabledProviders: ['microsoft'] as const,
    createOnboardingCsrfProof: vi.fn().mockReturnValue('csrf-proof'),
    microsoftSignup: signup,
    callbackExternal: vi.fn().mockResolvedValue({
      status: 'microsoft-email-required',
      pendingCredential: 'pending',
    }),
    startExternal: vi.fn(),
  };
  const app = createApp(
    { allowedOrigin: origin, externalAuthEnabled: true },
    undefined,
    undefined,
    undefined,
    auth,
  );
  await request(app)
    .get('/auth/callback/microsoft?state=state&code=code')
    .set('Cookie', 'hansel_external_microsoft=state')
    .expect(303);
  const pendingCookie = 'hansel_microsoft_pending=pending';
  const result = await request(app)
    .post('/api/auth/microsoft/signup/verify')
    .set('Origin', origin)
    .set('Cookie', pendingCookie)
    .send({ code: '123456' });
  expect(result.status).toBe(200);
  expect(result.headers['set-cookie']).toEqual(
    expect.arrayContaining([
      expect.stringContaining('hansel_onboarding=credential'),
    ]),
  );
  const withoutProviders = createApp(
    { allowedOrigin: origin, externalAuthEnabled: true },
    undefined,
    undefined,
    undefined,
    { login: vi.fn() },
  );
  await request(withoutProviders)
    .get('/api/auth/providers')
    .expect(200, { providers: [] });
  await request(withoutProviders)
    .get('/auth/start/google?intent=login')
    .expect(404);
  await request(app)
    .post('/auth/start/microsoft')
    .set('Origin', origin)
    .type('form')
    .send({ intent: 'onboarding', acceptsTerms: 'true', extra: 'no' })
    .expect(400);
});

it('signage schedule routes reject missing dependencies and invalid requests and map service failures', async () => {
  const f = {
    loadSignageSchedule: vi
      .fn()
      .mockResolvedValue({ canManageSigns: true, signTypes: [] }),
    createSignType: vi.fn().mockResolvedValue({}),
    updateSignType: vi.fn().mockResolvedValue({}),
    createSign: vi.fn().mockResolvedValue({}),
    updateSign: vi.fn().mockResolvedValue({}),
  };
  const sites = {
    listSites: vi.fn(),
    createSite: vi.fn(),
    loadSite: vi.fn(),
    ...f,
  };
  const variants = [
    ['get', '/signage-schedule', {}, f.loadSignageSchedule],
    ['post', '/sign-types', { name: 'Safety' }, f.createSignType],
    [
      'patch',
      '/sign-types/' + id,
      { name: 'Safety', expectedUpdatedAt: date },
      f.updateSignType,
    ],
    [
      'post',
      '/sign-types/' + id + '/signs',
      {
        code: 'RS.1',
        quantity: 1,
        location: 'Lobby',
        content: '',
        comments: '',
      },
      f.createSign,
    ],
    [
      'patch',
      '/signs/' + id,
      { field: 'code', value: 'RS.1', expectedUpdatedAt: date },
      f.updateSign,
    ],
  ] as const;
  for (const [method, path, body, fn] of variants) {
    const app = createApp(
        config,
        undefined,
        undefined,
        undefined,
        undefined,
        sites as never,
      ),
      base = '/api/sites/' + id + path;
    const call = (url = base, cookie = true, payload: object = body) => {
      const req = request(app)[method](url).set('Origin', origin);
      if (cookie) req.set('Cookie', 'hansel_access=test');
      return req.send(payload);
    };
    await call().expect(method === 'post' ? 201 : 200);
    await call(base, false).expect(401);
    await call(base.replace(id, 'bad')).expect(400);
    if (method !== 'get') await call(base, true, {}).expect(400);
    if (method === 'patch' || path.endsWith('/signs'))
      await call(
        base.replace(
          '/' + id + (path.endsWith('/signs') ? '/signs' : ''),
          '/bad' + (path.endsWith('/signs') ? '/signs' : ''),
        ),
      ).expect(400);
    fn.mockResolvedValueOnce(null);
    await call().expect(401);
    fn.mockRejectedValueOnce(new Error('unavailable'));
    await call().expect(503);
    const disabled = createApp(
      { ...config, signageScheduleEnabled: false },
      undefined,
      undefined,
      undefined,
      undefined,
      sites as never,
    );
    await request(disabled)
      [method](base)
      .set('Origin', origin)
      .send(body)
      .expect(404);
  }
  const incomplete = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    { listSites: vi.fn(), createSite: vi.fn(), loadSite: vi.fn() } as never,
  );
  await request(incomplete)
    .get('/api/sites/' + id + '/activity')
    .expect(404);
  await request(incomplete)
    .post('/api/sites/' + id + '/comments')
    .set('Origin', origin)
    .send({ text: 'Hello' })
    .expect(404);
});
it('registers each optional media route only when its feature is enabled', async () => {
  const services = {
    feature: {},
    attachments: {},
    resolve: vi.fn(),
    record: vi.fn(),
  };
  for (const flags of [false, true]) {
    const app = createApp(
      {
        ...config,
        signPhotosEnabled: flags,
        signDocumentsEnabled: flags,
        signCommentsEnabled: flags,
        planCommentsEnabled: flags,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        listSites: vi.fn(),
        createSite: vi.fn(),
        loadSite: vi.fn(),
        signPhotos: services,
        signDocuments: services,
        signComments: services,
        planComments: services,
      } as never,
    );
    for (const path of [
      '/signs/' + id + '/photos',
      '/signs/' + id + '/documents',
      '/signs/' + id + '/comments',
      '/allocation-plans/' + id + '/files/legacy/comments',
    ])
      await request(app)
        .get('/api/sites/' + id + path)
        .expect(flags ? 401 : 404);
  }
});
it('renders login with absent provider metadata and rejects authorization URLs without transaction state', async () => {
  const auth = {
    login: vi.fn().mockResolvedValue({ status: 'rejected' }),
    enabledProviders: ['google'] as const,
    startExternal: vi
      .fn()
      .mockResolvedValue('https://accounts.example/authorize'),
  };
  const app = createApp(
    { allowedOrigin: origin, externalAuthEnabled: true },
    undefined,
    undefined,
    undefined,
    auth,
  );
  await request(app).get('/auth/start/google?intent=login').expect(303);
  const absent = createApp(
    { allowedOrigin: origin, externalAuthEnabled: true },
    undefined,
    undefined,
    undefined,
    { login: auth.login },
  );
  await request(absent).get('/login').expect(200);
});

it('returns no providers when external authentication is disabled', async () => {
  await request(
    createApp({ allowedOrigin: origin }, undefined, undefined, undefined, {
      login: vi.fn(),
    }),
  )
    .get('/api/auth/providers')
    .expect(200, { providers: [] });
});
