/** @spec site-allocation-plan-preview REQ-006..REQ-013 @figma supplied 03.png */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PlanSign } from '@hansel/contracts';
import type { PlanSignsApi } from '../src/sites/plan-signs-api.js';
import { userEvent, within } from 'storybook/test';
import { AllocationPlanViewer } from '../src/sites/AllocationPlanViewer.js';

const plan = {
  id: '00000000-0000-4000-8000-000000000006',
  filename: 'Ground Floor.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: '2026-09-06T00:00:00.000Z',
  modifiedAt: '2026-09-06T00:00:00.000Z',
  uploadedBy: 'Nabin Singh',
};
const preview =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="black"><rect x="80" y="70" width="840" height="560"/><path d="M80 250h840M300 70v560M620 70v560M300 400h320"/></g><g font-family="sans-serif" font-size="24"><text x="390" y="170">ALLOCATION PLAN</text><text x="390" y="340">GROUND FLOOR</text></g></svg>',
  );

const meta = {
  title: 'Sites/Allocation Plan Viewer',
  component: AllocationPlanViewer,
  args: {
    plan,
    loadContent: () => Promise.resolve(new Blob()),
    render: () => Promise.resolve({ src: preview, release: () => undefined }),
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, context) => (
      <div
        className={`ml-[300px] px-8 ${context.args.planSignsApi ? 'pt-[119px]' : 'pt-[151px]'} max-md:ml-0 max-md:px-5`}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AllocationPlanViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ImagePlan: Story = {};
export const MultipleFiles: Story = {
  args: {
    plan: {
      ...plan,
      name: 'Building A',
      files: [
        'Ground Floor.png',
        'First Floor.png',
        'Second Floor.png',
        'Third Floor.png',
      ].map((filename, index) => ({
        id: `00000000-0000-4000-8000-00000000000${String(index + 1)}`,
        filename,
        mediaType: 'image/png',
        byteSize: 3,
      })),
    },
  },
};
export const FileDropdown: Story = {
  ...MultipleFiles,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Select plan file' }),
    );
  },
};
export const LongFilename: Story = {
  args: {
    plan: {
      ...plan,
      filename:
        'Building A - General Teaching Space - Allocation Plan Ground Floor.png',
    },
  },
};
export const Loading: Story = {
  args: { loadContent: () => new Promise(() => undefined) },
};
export const Failure: Story = {
  args: { loadContent: () => Promise.reject(new Error('unavailable')) },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Zoom200: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '50%', zoom: 2 }}>
        <Story />
      </div>
    ),
  ],
};
export const SpacePanArmed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('img', { name: plan.filename });
    await userEvent.hover(
      canvas.getByRole('region', { name: `${plan.filename} preview` }),
    );
    await userEvent.keyboard('[Space>]');
  },
};

function signApi(readonly = false, signFunction: PlanSign['function'] = 'Directional'): PlanSignsApi {
  const initial: PlanSign = {
    id: '00000000-0000-4000-8000-000000000011',
    fileId: null,
    x: 0.45,
    y: 0.55,
    code: 'SG.001',
    content: '',
    mounting: 'Wall-mounted',
    function: signFunction,
    colour: 'Red',
    orientation: 'down',
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
  let signs: PlanSign[] = [initial];
  return {
    load: () => Promise.resolve({ canManageSigns: !readonly, signs }),
    create: (input) => {
      const sign: PlanSign = {
        ...initial,
        id: crypto.randomUUID(),
        fileId: input.fileId,
        x: input.x,
        y: input.y,
        mounting: input.mounting ?? 'Wall-mounted',
        code: `SG.${String(signs.length + 1).padStart(3, '0')}`,
        updatedAt: new Date().toISOString(),
      };
      signs = [...signs, sign];
      return Promise.resolve(sign);
    },
    update: (id, input) => {
      const current = signs.find((sign) => sign.id === id);
      if (!current) return Promise.reject(new Error('not_found'));
      const sign = {
        ...current,
        x: input.x ?? current.x,
        y: input.y ?? current.y,
        code: input.code ?? current.code,
        content: input.content ?? current.content,
        mounting: input.mounting ?? current.mounting,
        function: input.function ?? current.function,
        orientation: input.orientation ?? current.orientation,
        updatedAt: new Date().toISOString(),
      };
      signs = signs.map((item) => (item.id === id ? sign : item));
      return Promise.resolve(sign);
    },
    remove: (id) => {
      signs = signs.filter((sign) => sign.id !== id);
      return Promise.resolve();
    },
  };
}
export const PopulatedSigns: Story = { args: { planSignsApi: signApi() } };
/** @spec allocation-plan-add-sign-tool REQ-001..008 */
const openAddMenu = async (canvasElement: HTMLElement, edge = false) => {
  const canvas = within(canvasElement);
  await canvas.findByRole('button', { name: 'Select sign SG.001' });
  await userEvent.click(canvas.getByRole('button', { name: 'Add sign' }));
  const drawing = canvas.getByLabelText('Plan drawing');
  const box = drawing.getBoundingClientRect();
  await userEvent.pointer({ target: drawing, keys: '[MouseLeft]', coords: { clientX: edge ? box.right - 10 : box.left + box.width * 0.65, clientY: edge ? box.bottom - 10 : box.top + box.height * 0.45 } });
};
export const AddSignCursor: Story = { args: { planSignsApi: signApi() }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByRole('button', { name: 'Select sign SG.001' });
  await userEvent.click(canvas.getByRole('button', { name: 'Add sign' }));
} };
export const AddSignMenu: Story = { args: { planSignsApi: signApi() }, play: async ({ canvasElement }) => { await openAddMenu(canvasElement); } };
export const AddSignMenuEdge: Story = { args: { planSignsApi: signApi() }, play: async ({ canvasElement }) => { await openAddMenu(canvasElement, true); } };
export const AddSignPending: Story = { args: { planSignsApi: { ...signApi(), create: () => new Promise(() => undefined) } }, play: async ({ canvasElement }) => {
  await openAddMenu(canvasElement);
  await userEvent.click(within(canvasElement).getByRole('menuitem', { name: 'Floor' }));
} };
export const AddSignFailure: Story = { args: { planSignsApi: { ...signApi(), create: () => Promise.reject(new Error('unavailable')) } }, play: async ({ canvasElement }) => {
  await openAddMenu(canvasElement);
  await userEvent.click(within(canvasElement).getByRole('menuitem', { name: 'Floor' }));
} };
export const DeletePending: Story = {
  args: {
    planSignsApi: { ...signApi(), remove: () => new Promise(() => undefined) },
  },
};
export const DeleteFailure: Story = {
  args: {
    planSignsApi: {
      ...signApi(),
      remove: () => Promise.reject(new Error('unavailable')),
    },
  },
};
export const MovableSigns: Story = { args: { planSignsApi: signApi() } };
export const MovingSign: Story = {
  args: { planSignsApi: signApi() },
  play: async ({ canvasElement }) => {
    const marker = await within(canvasElement).findByRole('button', {
      name: 'Select sign SG.001',
    });
    const box = marker.getBoundingClientRect();
    await userEvent.pointer([
      {
        target: marker,
        coords: { clientX: box.x + 10, clientY: box.y + 10 },
        keys: '[MouseLeft>]',
      },
      { target: marker, coords: { clientX: box.x + 70, clientY: box.y + 50 } },
    ]);
  },
};
export const MoveSaveFailure: Story = {
  args: {
    planSignsApi: {
      ...signApi(),
      update: () => Promise.reject(new Error('unavailable')),
    },
  },
};
export const SignDrawer: Story = {
  args: { planSignsApi: signApi() },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', {
        name: 'Select sign SG.001',
      }),
    );
  },
};
export const ReadOnlySigns: Story = { args: { planSignsApi: signApi(true) } };
/** @spec allocation-plan-hand-tool REQ-001..007 */
export const HandTool: Story = {
  args: { planSignsApi: signApi() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Select sign SG.001' });
    await userEvent.click(canvas.getByRole('button', { name: 'Hand' }));
  },
};
export const HandOverflow: Story = {
  args: { planSignsApi: signApi() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Select sign SG.001' });
    await userEvent.click(canvas.getByRole('button', { name: 'Hand' }));
    for (let i = 0; i < 4; i++) await userEvent.click(canvas.getByRole('button', { name: 'Increase plan zoom' }));
  },
};
export const HandGrabbing: Story = {
  args: { planSignsApi: signApi() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Select sign SG.001' });
    await userEvent.click(canvas.getByRole('button', { name: 'Hand' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Increase plan zoom' }));
    const viewport = canvas.getByLabelText('Plan viewport');
    const box = viewport.getBoundingClientRect();
    await userEvent.pointer([
      { target: viewport, coords: { clientX: box.x + 100, clientY: box.y + 100 }, keys: '[MouseLeft>]' },
      { target: viewport, coords: { clientX: box.x + 60, clientY: box.y + 60 } },
    ]);
  },
};
export const SignSaveFailure: Story = {
  args: {
    planSignsApi: {
      ...signApi(),
      create: () => Promise.reject(new Error('unavailable')),
    },
  },
};
export const SignSaving: Story = {
  args: {
    planSignsApi: { ...signApi(), create: () => new Promise(() => undefined) },
  },
};
export const EmptySigns: Story = {
  args: {
    planSignsApi: {
      ...signApi(),
      load: () => Promise.resolve({ signs: [], canManageSigns: true }),
    },
  },
};

/** @spec sign-function-options REQ-001, REQ-005 */
export const FunctionIdentification: Story = { ...SignDrawer, args: { planSignsApi: signApi(false, 'Identification') } };
export const FunctionDirectional: Story = { ...SignDrawer, args: { planSignsApi: signApi(false, 'Directional') } };
export const FunctionInformational: Story = { ...SignDrawer, args: { planSignsApi: signApi(false, 'Informational') } };
export const FunctionRegulatory: Story = { ...SignDrawer, args: { planSignsApi: signApi(false, 'Regulatory/Statutory') } };
export const FunctionReadOnly: Story = { ...SignDrawer, args: { planSignsApi: signApi(true, 'Regulatory/Statutory') } };
