/** @spec sign-function-options REQ-001, REQ-002, REQ-005 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AllocationPlanViewer } from './AllocationPlanViewer.js';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import type { PlanSign, PlanSignPatch } from '@hansel/contracts';

afterEach(cleanup);

const values = [
  'Identification',
  'Directional',
  'Informational',
  'Regulatory/Statutory',
];
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
        function: input.function ?? sign.function,
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
  const field = screen.getByRole('combobox', { name: 'Function' });
  fireEvent.click(field);
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(values);
  fireEvent.keyDown(field, { key: 'Escape' });
  for (const value of values) {
    fireEvent.click(screen.getByRole('combobox', { name: 'Function' }));
    fireEvent.click(screen.getByRole('option', { name: value }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Function' }),
      ).toHaveTextContent(value),
    );
    expect(api.update).toHaveBeenLastCalledWith(
      'sign',
      expect.objectContaining({
        function: value,
        expectedUpdatedAt: expect.any(String),
      }),
    );
    view.unmount();
    view = render(element);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Select sign SG.001' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Function' }),
    ).toHaveTextContent(value);
  }
});
it('REQ-005 shows a disabled current value to Viewers', async () => {
  const { element } = setup(false);
  render(element);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  expect(screen.getByRole('combobox', { name: 'Function' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Function' })).toHaveTextContent(
    'Directional',
  );
});
it('REQ-002 retains the saved value after failure and retries the chosen value', async () => {
  const { api, element } = setup();
  api.update.mockRejectedValueOnce(new Error('unavailable'));
  render(element);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Function' }));
  fireEvent.click(screen.getByRole('option', { name: 'Informational' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Function' }),
    ).toHaveTextContent('Informational'),
  );
});

it('REQ-005 keeps Space on Function available to the custom dropdown instead of panning', async () => {
  const { api } = setup();
  render(
    <AllocationPlanViewer
      plan={{
        id: 'plan',
        filename: 'Plan.png',
        mediaType: 'image/png',
        byteSize: 1,
        createdAt: '2026-09-22T00:00:00.000Z',
        modifiedAt: '2026-09-22T00:00:00.000Z',
        uploadedBy: 'Editor',
      }}
      planSignsApi={api}
      loadContent={() => Promise.resolve(new Blob())}
      render={() => Promise.resolve({ src: 'plan.png', release: vi.fn() })}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  const preview = screen.getByRole('region', { name: 'Plan.png preview' });
  fireEvent.pointerEnter(preview);
  expect(
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Function' }), {
      key: ' ',
      code: 'Space',
    }),
  ).toBe(false);
  expect(screen.getByRole('listbox', { name: 'Function' })).toBeVisible();
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Function' }), {
    key: 'Escape',
  });
  expect(screen.getByLabelText('Sign details')).toBeVisible();
  expect(preview).not.toHaveClass('cursor-grab');
});

it('sign-attribute-custom-dropdowns REQ-002..005: Colour is custom and choosing Red is a no-op', async () => {
  const { api, element } = setup();
  render(element);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  const colour = screen.getByRole('combobox', { name: 'Colour' });
  expect(colour.tagName).toBe('BUTTON');
  fireEvent.click(colour);
  expect(screen.getByRole('listbox', { name: 'Colour' })).toBeVisible();
  fireEvent.click(screen.getByRole('option', { name: 'Red' }));
  expect(api.update).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
