/** @spec allocation-plan-add-sign-tool REQ-001..008 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlanSignCreate } from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import { AddSignMenu } from './AddSignMenu.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('REQ-003,007,008: menu flips inside bounds, supports reverse navigation and dismisses on resize', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 160, 282),
  );
  const dismiss = vi.fn();
  render(
    <AddSignMenu
      point={{ x: 380, y: 700 }}
      bounds={{ left: 20, right: 370, top: 179, bottom: 704 }}
      onDismiss={dismiss}
      onChoose={vi.fn()}
    />,
  );
  const menu = screen.getByRole('menu');
  expect(menu).toHaveStyle({ left: '204px', top: '422px' });
  fireEvent.pointerDown(menu);
  fireEvent.click(menu);
  fireEvent.scroll(menu);
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(screen.getByRole('menuitem', { name: 'Floor' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Home' });
  expect(screen.getByRole('menuitem', { name: 'Freestanding' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Tab' });
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(document.body);
  expect(dismiss).toHaveBeenCalledTimes(1);
  fireEvent(window, new Event('resize'));
  expect(dismiss).toHaveBeenCalledTimes(2);
});
async function setup() {
  const api = {
    load: vi.fn().mockResolvedValue({ signs: [], canManageSigns: true }),
    create: vi.fn().mockImplementation((input: PlanSignCreate) =>
      Promise.resolve({
        ...input,
        id: 'sign',
        code: 'SG.001',
        mounting: input.mounting,
        content: '',
        function: 'Wayfinder',
        colour: 'Red',
        orientation: 'down',
        updatedAt: new Date().toISOString(),
      }),
    ),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const props = {
    api,
    fileId: null,
    panning: false,
    drawerHost: document.body,
    children: <img alt="Plan" />,
  };
  const view = render(<PlanSignsSurface {...props} />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Add sign' })).toBeEnabled();
  });
  const drawing = screen.getByLabelText('Plan drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  return { api, drawing, props, view };
}
it('REQ-002,004,006: chooses Floor before creating at the captured point and returns to Move', async () => {
  const { api, drawing } = await setup();
  fireEvent.click(drawing, { clientX: 250, clientY: 200 });
  expect(api.create).not.toHaveBeenCalled();
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent),
  ).toEqual([
    'Freestanding',
    'Wall-mounted',
    'Overhead',
    'Cantilevered',
    'Floor',
    '+New type',
  ]);
  expect(screen.getByRole('menuitem', { name: /New type/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  await screen.findByLabelText('Sign details');
  expect(api.create).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ x: 0.25, y: 0.25, mounting: 'Floor' }),
  );
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
    'Floor',
  );
});
it('REQ-003,007: keyboard navigation and dismissal never create a Sign', async () => {
  const { api, drawing, props, view } = await setup();
  fireEvent.keyDown(drawing, { key: 'Enter' });
  const menu = screen.getByRole('menu');
  expect(screen.getByRole('menuitem', { name: 'Freestanding' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Floor' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Freestanding' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(drawing).toHaveFocus();
  fireEvent.click(drawing, { clientX: 500, clientY: 400 });
  fireEvent.click(drawing, { clientX: 600, clientY: 400 });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.scroll(document);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.keyDown(drawing, { key: 'Enter' });
  view.rerender(<PlanSignsSurface {...props} viewScale={150} />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.keyDown(drawing, { key: 'Enter' });
  view.rerender(<PlanSignsSurface {...props} panning />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(api.create).not.toHaveBeenCalled();
});
it('REQ-005: failed creation retains placement and mounting for idempotent retry', async () => {
  const { api, drawing } = await setup();
  api.create.mockRejectedValueOnce(new Error('unavailable'));
  fireEvent.click(drawing, { clientX: 600, clientY: 400 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Overhead' }));
  await screen.findByText('We couldn’t save. Please try again.');
  expect(screen.getByRole('button', { name: 'Add sign' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByLabelText('Sign details');
  expect(api.create.mock.calls[0]).toEqual(api.create.mock.calls[1]);
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({ x: 0.6, y: 0.5, mounting: 'Overhead' }),
  );
});
it.each(['Freestanding', 'Wall-mounted', 'Overhead', 'Cantilevered', 'Floor'])(
  'REQ-004,008: %s placement keeps fixed controls clear and saves once',
  async (mounting) => {
    const { api, drawing } = await setup();
    api.create.mockReturnValue(new Promise(() => undefined));
    fireEvent.click(drawing, { clientX: 990, clientY: 760 });
    expect(screen.getByRole('menu')).toHaveStyle({ maxHeight: '568px' });
    fireEvent.click(screen.getByRole('menuitem', { name: mounting }));
    fireEvent.click(drawing, { clientX: 200, clientY: 200 });
    fireEvent.keyDown(drawing, { key: 'Enter' });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ mounting }),
    );
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  },
);
