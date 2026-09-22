import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PlanSignsSurface } from './PlanSignsSurface.js';

it('allocation-plan-signs REQ-002: viewers cannot create and disabled tabs remain inactive', async () => {
  const sign = {
    id: 'sign',
    fileId: null,
    x: 0.5,
    y: 0.5,
    code: 'SG.001',
    content: '',
    mounting: 'Wall-mounted' as const,
    function: 'Directional' as const,
    colour: 'Red' as const,
    orientation: 'down' as const,
    updatedAt: new Date().toISOString(),
  };
  const api = {
    load: vi.fn().mockResolvedValue({ canManageSigns: false, signs: [sign] }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
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
  expect(screen.getByRole('tab', { name: 'Docs' })).toBeDisabled();
  expect(screen.getByLabelText('Sign code')).toHaveAttribute('readonly');
  expect(
    screen.queryByRole('button', { name: 'Delete sign' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Plan drawing'));
  await waitFor(() => { expect(api.create).not.toHaveBeenCalled(); });
});
