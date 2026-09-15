import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlanSign } from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import { PlanSignRequestError } from './plan-signs-api.js';

// Dialog focus/backdrop behavior is covered with the real native dialog in Playwright.
vi.mock('./SignDeleteDialog.js', () => ({
  SignDeleteDialog: ({
    code,
    pending,
    error,
    conflict,
    onCancel,
    onConfirm,
    onReload,
  }: {
    code: string;
    pending: boolean;
    error: string;
    conflict: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    onReload: () => void;
  }) => (
    <div role="dialog" aria-label={`Delete sign ${code}`}>
      <button disabled={pending} onClick={onCancel}>
        Cancel
      </button>
      <button disabled={pending} onClick={conflict ? onReload : onConfirm}>
        {pending ? 'Deleting…' : conflict ? 'Reload' : 'Delete'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  ),
}));
afterEach(cleanup);
const sign: PlanSign = {
  id: 'sign-id',
  fileId: null,
  x: 0.5,
  y: 0.5,
  code: 'SG.001',
  content: '',
  mounting: 'Wall-mounted',
  function: 'Wayfinder',
  colour: 'Red',
  orientation: 'down',
  updatedAt: '2026-09-15T00:00:00.000Z',
};
async function setup(remove: () => Promise<void>) {
  const api = {
    load: vi.fn().mockResolvedValue({ canManageSigns: true, signs: [sign] }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(remove),
  };
  render(
    <PlanSignsSurface
      api={api}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Delete sign' }),
  );
  return api;
}
it('plan-sign-delete-dialog REQ-001,005: opening and cancelling make no request', async () => {
  const api = await setup(() => Promise.resolve());
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete sign SG.001');
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.remove).not.toHaveBeenCalled();
});
it('plan-sign-delete-dialog REQ-006: submits captured identity once and closes after success', async () => {
  let finish: () => void = () => undefined;
  const api = await setup(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Deleting…' }));
  expect(api.remove).toHaveBeenCalledTimes(1);
  expect(api.remove).toHaveBeenCalledWith(sign.id, sign.updatedAt);
  expect(screen.getByText('Cancel')).toBeDisabled();
  finish();
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  expect(
    screen.queryByRole('button', { name: 'Select sign SG.001' }),
  ).not.toBeInTheDocument();
});
it('plan-sign-delete-dialog REQ-006: stale deletion requires reload without retrying delete', async () => {
  const api = await setup(() => Promise.reject(new PlanSignRequestError(409)));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await screen.findByRole('alert');
  expect(
    screen.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText('Reload'));
  await waitFor(() => {
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  expect(api.remove).toHaveBeenCalledTimes(1);
});
