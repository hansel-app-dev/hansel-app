/** @spec allocation-plan-add-area REQ-001,005,006,008,011
 * @spec allocation-plan-area-auto-move REQ-001,002 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlanArea, PlanAreaCreate, PlanSign } from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('guards shared selection, clears Area details before Sign selection and forwards drawing keyboard input', async () => {
  const area: PlanArea = {
    id: crypto.randomUUID(),
    fileId: null,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    code: 'Ar.01',
    content: '',
    orientation: 'down',
    type: 'Floor',
    function: 'Environmental',
    colour: 'Blue',
    updatedAt: new Date().toISOString(),
  };
  const sign: PlanSign = {
    id: crypto.randomUUID(),
    fileId: null,
    x: 0.7,
    y: 0.7,
    code: 'SG.001',
    content: '',
    orientation: 'down',
    mounting: 'Wall-mounted',
    function: 'Directional',
    colour: 'Red',
    updatedAt: area.updatedAt,
  };
  const areas = {
    load: vi.fn().mockResolvedValue({ areas: [area], canManageAreas: true }),
    create: vi.fn((input: PlanAreaCreate) =>
      Promise.resolve({
        ...area,
        ...input,
        id: crypto.randomUUID(),
        code: 'Ar.02',
      }),
    ),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const api = {
    areas,
    load: vi.fn().mockResolvedValue({ signs: [sign], canManageSigns: true }),
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
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  fireEvent.change(screen.getByLabelText('Area code'), {
    target: { value: 'Draft' },
  });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  expect(screen.getByLabelText('Area details')).toBeInTheDocument();
  expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Sign details')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
  const drawing = screen.getByLabelText('Plan drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  const areaDrawing = screen.getByLabelText('Area drawing');
  vi.spyOn(areaDrawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'ArrowLeft' });
  fireEvent.keyDown(drawing, { key: 'ArrowUp' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(areas.create).not.toHaveBeenCalled();
  fireEvent.keyDown(drawing, { key: 'ArrowRight' });
  fireEvent.keyDown(drawing, { key: 'ArrowDown' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  await waitFor(() => {
    expect(areas.create).toHaveBeenCalledTimes(1);
  });
  expect(api.create).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
  });
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(drawing);
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
});
