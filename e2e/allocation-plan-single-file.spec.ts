import { expect, test } from '@playwright/test';

test('allocation-plan-single-file REQ-003..005: plan selector, direct links and browser history agree', async ({
  page,
}) => {
  const siteId = '00000000-0000-4000-8000-000000000010';
  const plans = ['Ground', 'First'].map((name, index) => ({
    id: `00000000-0000-4000-8000-00000000000${String(index + 1)}`,
    name,
    filename: `${name}.png`,
    mediaType: 'image/png',
    byteSize: 68,
    createdAt: '2026-09-23T00:00:00.000Z',
    modifiedAt: '2026-09-23T00:00:00.000Z',
    uploadedBy: 'Owner',
  }));
  const first = plans[0];
  const second = plans[1];
  if (!first || !second) throw new Error('Expected two plans');
  const site = {
    id: siteId,
    name: 'Test Site',
    createdAt: first.createdAt,
    updatedAt: first.createdAt,
    memberCount: 0,
    memberPreview: [],
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/content')) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6p8AAAAASUVORK5CYII=',
          'base64',
        ),
      });
      return;
    }
    const body = path.endsWith('/dashboard')
      ? { viewer: { displayName: 'Owner', initials: 'O', roleLabel: 'Owner' } }
      : path.endsWith('/allocation-plans')
        ? { canAddPlans: true, plans }
        : path.endsWith('/signs')
          ? { canManageSigns: true, signs: [] }
          : path === '/api/sites'
            ? {
                organizationName: 'Hansel',
                canCreateSite: true,
                canInviteMembers: true,
                creator: {
                  email: 'owner@example.test',
                  displayName: 'Owner',
                  initials: 'O',
                },
                siteLimitReached: false,
                maximumSites: null,
                members: [],
                sites: [site],
              }
            : { site: { id: siteId, name: site.name } };
    await route.fulfill({ json: body });
  });
  const path = (index: number) =>
    `/sites/${siteId}/allocations/${(plans[index] ?? first).id}`;
  await page.goto(path(0));
  await expect(page.getByRole('img', { name: 'Ground.png' })).toBeVisible();
  let documentRequests = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest()) documentRequests++;
  });
  await page.getByRole('button', { name: 'Select allocation plan' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(2);
  await page.getByRole('menuitem', { name: /First/ }).click();
  await expect(page).toHaveURL(new RegExp(`${second.id}$`));
  await expect(page.getByRole('img', { name: 'First.png' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('img', { name: 'Ground.png' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('img', { name: 'First.png' })).toBeVisible();
  expect(documentRequests).toBe(0);
  await page.reload();
  await expect(page.getByRole('img', { name: 'First.png' })).toBeVisible();
});
