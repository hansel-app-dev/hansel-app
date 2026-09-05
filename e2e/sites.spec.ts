import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';

test('both New site actions complete the accessible People You Invite flow [sites-access-scope AC-001, AC-003, AC-007]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.route('**/api/sites', async (route) => {
    if (route.request().method() === 'POST') {
      const request = route.request().postDataJSON() as {
        accessScope: string;
        name: string;
        assignments: { email: string; role: string }[];
      };
      expect(request.name).toBe('Sydney Central');
      expect(request.accessScope).toBe('PEOPLE_INVITED');
      expect(request.assignments).toEqual([
        { email: 'viewer@example.com', role: 'VIEWER' },
      ]);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          siteId,
          destination: `/sites/${siteId}/activity`,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [
          {
            email: 'editor@example.com',
            displayName: 'Ed Itor',
            initials: 'EI',
          },
        ],
        sites: [],
      }),
    });
  });
  await page.route(`**/api/sites/${siteId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ site: { id: siteId, name: 'Sydney Central' } }),
    }),
  );

  await page.goto('/sites');
  const actions = page.getByRole('button', { name: 'New site' });
  await expect(actions).toHaveCount(2);
  await actions.nth(1).click();
  const dialog = page.getByRole('dialog', { name: 'Add new site' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Step 1 of 1')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(actions.nth(1)).toBeFocused();

  await actions.first().click();
  await dialog.getByLabel('Name').fill('Sydney Central');
  await dialog.getByRole('combobox', { name: 'Who has access' }).click();
  await dialog.getByRole('option', { name: 'People you invite' }).click();
  await expect(dialog.getByText('Step 1 of 2')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Step 2 of 2')).toBeVisible();
  await dialog.getByLabel('Email or team member').fill('viewer@example.com');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog.getByRole('alert')).toContainText('needs a paid seat');
  await expect(
    dialog.getByRole('button', { name: 'Create site' }),
  ).toBeDisabled();
  await dialog.getByLabel('Role for viewer@example.com').selectOption('VIEWER');
  await dialog.getByRole('button', { name: 'Create site' }).click();

  await expect(page).toHaveURL(new RegExp(`/sites/${siteId}/activity$`));
  await expect(
    page.getByRole('heading', { name: 'Sydney Central' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Site sections' }),
  ).toContainText('Activity');
});

test('Organization and Private create exact branch-specific requests [sites-access-scope AC-001, AC-002]', async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.route('**/api/sites', (route) => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          siteId,
          destination: `/sites/${siteId}/activity`,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [],
        sites: [],
      }),
    });
  });
  await page.route(`**/api/sites/${siteId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ site: { id: siteId, name: 'New site' } }),
    }),
  );

  await page.goto('/sites');
  await page.getByRole('button', { name: 'New site' }).first().click();
  await page.getByRole('button', { name: 'Add new site' }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${siteId}/activity$`));

  await page.goto('/sites');
  await page.getByRole('button', { name: 'New site' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add new site' });
  await dialog.getByRole('combobox', { name: 'Who has access' }).click();
  await dialog.getByRole('option', { name: 'Private' }).click();
  await dialog.getByRole('button', { name: 'Add new site' }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${siteId}/activity$`));

  expect(requests).toEqual([
    {
      name: 'New site',
      accessScope: 'ORGANIZATION',
      organizationAccess: 'VIEW_COMMENT',
      idempotencyKey: expect.any(String),
    },
    {
      name: 'New site',
      accessScope: 'PRIVATE',
      idempotencyKey: expect.any(String),
    },
  ]);
});

test('add-site access selector reflows and explains the Free-plan boundary at 320px [sites-access-scope AC-005, AC-007]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.route('**/api/sites', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: false,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: 1,
        members: [
          {
            email: 'editor@example.com',
            displayName: 'Ed Itor',
            initials: 'EI',
          },
        ],
        sites: [],
      }),
    }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/sites');
  await page.getByRole('button', { name: 'New site' }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Add new site' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.getByRole('combobox', { name: 'Who has access' }).click();
  const inviteOnly = page.getByRole('option', { name: 'People you invite' });
  await expect(inviteOnly).toHaveAttribute('aria-disabled', 'true');
  await inviteOnly.click({ force: true });
  await expect(page.getByRole('alert')).toContainText('Upgrade your plan');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('plan and role boundaries disable site creation with a clear reason [sites-add-new AC-004, AC-005]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        viewer: { displayName: 'Ed Itor', initials: 'EI', roleLabel: 'Editor' },
      }),
    }),
  );
  await page.route('**/api/sites', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: false,
        canInviteMembers: false,
        creator: {
          email: 'editor@example.com',
          displayName: 'Ed Itor',
          initials: 'EI',
        },
        siteLimitReached: true,
        maximumSites: 1,
        members: [],
        sites: [{ id: siteId, name: 'Only site' }],
      }),
    }),
  );
  await page.goto('/sites');
  await expect(page.getByText(/reached its site limit/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'New site' })).toBeDisabled();
});

test('a failed create can be retried with the same idempotency key [sites-add-new AC-003]', async ({
  page,
}) => {
  let attempts = 0;
  const keys: string[] = [];
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.route('**/api/sites', (route) => {
    if (route.request().method() === 'POST') {
      attempts += 1;
      keys.push(
        (route.request().postDataJSON() as { idempotencyKey: string })
          .idempotencyKey,
      );
      return route.fulfill(
        attempts === 1
          ? {
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'sites_unavailable' }),
            }
          : {
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                siteId,
                destination: `/sites/${siteId}/activity`,
              }),
            },
      );
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [],
        sites: [],
      }),
    });
  });
  await page.route(`**/api/sites/${siteId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ site: { id: siteId, name: 'New site' } }),
    }),
  );
  await page.goto('/sites');
  await page.getByRole('button', { name: 'New site' }).first().click();
  await page.getByRole('button', { name: 'Add new site' }).click();
  await expect(page.getByRole('alert')).toContainText("couldn't create");
  await page.getByRole('button', { name: 'Add new site' }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${siteId}/activity$`));
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test('an expired application session leaves Sites for login [sites-add-new AC-006]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'authentication_required' }),
    }),
  );
  await page.route('**/api/sites', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'authentication_required' }),
    }),
  );
  await page.goto('/sites');
  await expect(page).toHaveURL(/\/login$/);
});
