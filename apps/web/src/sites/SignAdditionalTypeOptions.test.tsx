/** @spec sign-additional-type-options REQ-003, REQ-005 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import type { PlanSign, PlanSignPatch } from '@hansel/contracts';

afterEach(cleanup);

const values = ['Safety Decal', 'Privacy Decal', 'Environmental'];
function setup(canManageSigns = true) {
  let sign: PlanSign = {
    id: 'sign',
    fileId: null,
    x: 0.5,
    y: 0.5,
    code: 'SG.001',
    content: '',
    mounting: 'Wall-mounted',
    function: 'Directional',
    colour: 'Red',
    orientation: 'down',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
  const api = {
    load: vi.fn(() => Promise.resolve({ canManageSigns, signs: [sign] })),
    create: vi.fn(),
    remove: vi.fn(),
    update: vi.fn((_id: string, input: PlanSignPatch) => {
      sign = {
        ...sign,
        mounting: input.mounting ?? sign.mounting,
        updatedAt: new Date(Date.parse(sign.updatedAt) + 1).toISOString(),
      };
      return Promise.resolve(sign);
    }),
  };
  const element = (
    <PlanSignsSurface
      api={api}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>
  );
  return { api, element };
}
it('REQ-001,002 offers exact choices and saves each through reload', async () => {
  const { api, element } = setup();
  let view = render(element);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  const field = screen.getByRole('combobox', { name: 'Type' });
  fireEvent.click(field);
  expect(
    screen
      .getAllByRole('option')
      .map((option) => option.textContent)
      .slice(-3),
  ).toEqual(values);
  fireEvent.keyDown(field, { key: 'Escape' });
  for (const value of values) {
    fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
    fireEvent.click(screen.getByRole('option', { name: value }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
        value,
      ),
    );
    expect(api.update).toHaveBeenLastCalledWith(
      'sign',
      expect.objectContaining({
        mounting: value,
        expectedUpdatedAt: expect.any(String),
      }),
    );
    view.unmount();
    view = render(element);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Select sign SG.001' }),
    );
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
      value,
    );
  }
});
