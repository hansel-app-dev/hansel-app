import { expect, test } from '@playwright/test';
import type { Sign } from '@hansel/contracts';

test('signage-schedule-remove-status AC-001,002: browser creates, edits and reloads status-free Signs', async ({
  page,
}) => {
  const siteId = '00000000-0000-4000-8000-000000000001';
  const typeId = '00000000-0000-4000-8000-000000000010';
  const now = '2026-09-27T00:00:00.000Z';
  const site = {
    id: siteId,
    name: 'Schedule test',
    createdAt: now,
    updatedAt: now,
    memberCount: 0,
    memberPreview: [],
  };
  const signs: Sign[] = [];
  // Browser/client contract check. Real persistence is covered by the PostgreSQL integration test.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/signs') && method === 'POST') {
      const values = route.request().postDataJSON() as Record<string, unknown>;
      expect(values).toEqual({
        code: 'SG.001',
        quantity: 1,
        location: '',
        content: '',
        comments: '',
      });
      const sign: Sign = {
        id: '00000000-0000-4000-8000-000000000011',
        signTypeId: typeId,
        code: 'SG.001',
        quantity: 1,
        location: '',
        content: '',
        comments: '',
        createdAt: now,
        updatedAt: now,
      };
      signs.push(sign);
      await route.fulfill({ status: 201, json: sign });
      return;
    }
    if (path.includes('/signs/') && method === 'PATCH') {
      const values = route.request().postDataJSON() as Record<string, unknown>;
      expect(values).toEqual({
        field: 'location',
        value: 'Lobby',
        expectedUpdatedAt: now,
      });
      const sign = signs[0];
      if (!sign) throw new Error('Expected a created Sign');
      sign.location = 'Lobby';
      sign.updatedAt = '2026-09-27T00:00:01.000Z';
      await route.fulfill({ json: sign });
      return;
    }
    const body = path.endsWith('/dashboard')
      ? { viewer: { displayName: 'Owner', initials: 'O', roleLabel: 'Owner' } }
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
        : path.endsWith('/signage-schedule')
          ? {
              canManageSigns: true,
              signTypes: [
                {
                  id: typeId,
                  name: 'Plan signs',
                  color: 'SLATE',
                  createdAt: now,
                  updatedAt: now,
                  quantityTotal: signs.length,
                  signs,
                },
              ],
            }
          : { site: { id: siteId, name: site.name } };
    await route.fulfill({ json: body });
  });
  await page.goto(`/sites/${siteId}/signage-schedule`);
  await expect(
    page.getByRole('region', { name: 'Signage Schedule' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: /Add sign/ }).click();
  const code = page.getByRole('textbox', { name: /New sign code/ });
  await code.fill('SG.001');
  await code.press('Enter');
  const location = page.getByRole('textbox', { name: 'SG.001 location' });
  await location.fill('Lobby');
  await location.press('Enter');
  await expect(location).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'SG.001 location' }),
  ).toHaveValue('Lobby');
  await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(
    0,
  );
});
