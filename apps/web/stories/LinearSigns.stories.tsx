/** @spec allocation-plan-add-linear REQ-001..012 */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { planSignSchema, type PlanSign } from '@hansel/contracts';
import { AllocationPlanViewer } from '../src/sites/AllocationPlanViewer.js';
import {
  PlanSignRequestError,
  type PlanSignsApi,
} from '../src/sites/plan-signs-api.js';
import { areaFixture } from './area-fixture.js';
const initial: PlanSign = {
  id: '00000000-0000-4000-8000-000000000011',
  fileId: null,
  x: 0.42,
  y: 0.32,
  endX: 0.64,
  endY: 0.32,
  placementKind: 'linear',
  code: 'Pr.01',
  mounting: 'Safety Decal',
  colour: 'Orange',
  function: 'Regulatory/Statutory',
  orientation: 'down',
  content: '',
  updatedAt: '2026-09-23T00:00:00.000Z',
};
function fixture(mode = 'normal'): PlanSignsApi {
  let signs: PlanSign[] = [
    initial,
    {
      ...initial,
      id: '00000000-0000-4000-8000-000000000012',
      placementKind: 'point',
      endX: null,
      endY: null,
      x: 0.18,
      y: 0.7,
      code: 'SG.001',
      colour: 'Red',
      mounting: 'Wall-mounted',
    },
  ];
  const requests = new Map<string, PlanSign>();
  let failed = false;
  const gate = () => {
    if (mode === 'pending') return new Promise<void>(() => undefined);
    if (mode === 'conflict')
      return Promise.reject(new PlanSignRequestError(409));
    if (mode === 'failure' && !failed) {
      failed = true;
      return Promise.reject(new Error('unavailable'));
    }
    return Promise.resolve();
  };
  return {
    ...(mode === 'viewer' ? {} : { areas: areaFixture() }),
    load: () => Promise.resolve({ canManageSigns: mode !== 'viewer', signs }),
    create: async (input) => {
      await gate();
      const replay = requests.get(input.idempotencyKey);
      if (replay) return replay;
      const { idempotencyKey, ...placement } = input;
      const sign: PlanSign = {
        ...initial,
        ...placement,
        mounting: input.mounting ?? 'Safety Decal',
        id: crypto.randomUUID(),
        code: `Pr.${String(signs.filter((s) => s.placementKind === 'linear').length + 1).padStart(2, '0')}`,
        updatedAt: new Date().toISOString(),
      };
      signs = [...signs, sign];
      requests.set(idempotencyKey, sign);
      return sign;
    },
    update: async (id, input) => {
      await gate();
      const current = signs.find((s) => s.id === id);
      if (!current) throw new Error('not_found');
      const { expectedUpdatedAt, ...changes } = input;
      if (current.updatedAt !== expectedUpdatedAt)
        throw new PlanSignRequestError(409);
      const sign = planSignSchema.parse({
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
      });
      signs = signs.map((s) => (s.id === id ? sign : s));
      return sign;
    },
    remove: async (id) => {
      await gate();
      signs = signs.filter((s) => s.id !== id);
    },
  };
}
const plan = {
  id: '00000000-0000-4000-8000-000000000006',
  filename: 'First Floor.png',
  name: 'First Floor',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: initial.updatedAt,
  modifiedAt: initial.updatedAt,
  uploadedBy: 'Nabin Singh',
};
const preview =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="#555"><rect x="80" y="70" width="840" height="560"/><path d="M80 250h840M300 70v560M620 70v560M300 400h320"/></g><g font-family="sans-serif" font-size="16"><text x="390" y="170">FIRST FLOOR</text><text x="390" y="340">LEARNING 01</text></g></svg>',
  );
function Example({ mode = 'normal' }: { mode?: string }) {
  const [api] = useState(() => fixture(mode));
  return (
    <div className="ml-[300px] px-8 pt-[119px] max-md:ml-0 max-md:px-5">
      <AllocationPlanViewer
        plan={plan}
        planSignsApi={api}
        loadContent={() => Promise.resolve(new Blob())}
        render={() =>
          Promise.resolve({ src: preview, release: () => undefined })
        }
      />
    </div>
  );
}
const meta = {
  title: 'Sites/Linear Signs',
  component: Example,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
const select = async (element: HTMLElement) => {
  await userEvent.click(
    await within(element).findByRole('button', { name: 'Select sign Pr.01' }),
  );
};
export const Selected: Story = {
  play: async ({ canvasElement }) => select(canvasElement),
};
export const Viewer: Story = {
  args: { mode: 'viewer' },
  play: async ({ canvasElement }) => select(canvasElement),
};
const menu = async (element: HTMLElement) => {
  const c = within(element);
  await c.findByRole('button', { name: 'Select sign Pr.01' });
  await userEvent.click(c.getByRole('button', { name: 'Add linear' }));
  const d = c.getByLabelText('Linear drawing');
  d.focus();
  await userEvent.keyboard('{Enter}');
};
export const Menu: Story = {
  play: async ({ canvasElement }) => menu(canvasElement),
};
const arm = async (element: HTMLElement) => {
  await menu(element);
  await userEvent.click(
    within(element).getByRole('menuitem', { name: 'Safety Decal' }),
  );
};
export const Armed: Story = {
  play: async ({ canvasElement }) => arm(canvasElement),
};
const draw = async (element: HTMLElement) => {
  await arm(element);
  await userEvent.keyboard('{Enter}{ArrowRight}{ArrowRight}{ArrowDown}');
};
export const Drawing: Story = {
  play: async ({ canvasElement }) => draw(canvasElement),
};
export const EndpointEditing: Story = {
  play: async ({ canvasElement }) => {
    await select(canvasElement);
    within(canvasElement)
      .getByRole('button', { name: 'Resize Pr.01 end endpoint' })
      .focus();
    await userEvent.keyboard('{Enter}{ArrowDown}');
  },
};
export const Pending: Story = {
  args: { mode: 'pending' },
  play: async ({ canvasElement }) => {
    await draw(canvasElement);
    await userEvent.keyboard('{Enter}');
  },
};
export const Failure: Story = {
  args: { mode: 'failure' },
  play: async ({ canvasElement }) => {
    await draw(canvasElement);
    await userEvent.keyboard('{Enter}');
  },
};
export const Conflict: Story = {
  args: { mode: 'conflict' },
  play: async ({ canvasElement }) => {
    await select(canvasElement);
    within(canvasElement)
      .getByRole('button', { name: 'Select sign Pr.01' })
      .focus();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
  },
};
