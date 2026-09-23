/** @spec allocation-plan-add-area REQ-012 */
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { PlanArea } from '@hansel/contracts';
import { PlanAreas } from '../src/sites/PlanAreas.js';
import type { PlanAreasApi } from '../src/sites/plan-areas-api.js';
import { PlanToolbar, type PlanTool } from '../src/sites/PlanToolbar.js';
const initial: PlanArea = {
  id: '00000000-0000-4000-8000-000000000001',
  fileId: null,
  x: 0.25,
  y: 0.2,
  width: 0.25,
  height: 0.35,
  code: 'Ar.01',
  content: '',
  orientation: 'down',
  type: 'Floor',
  function: 'Environmental',
  colour: 'Blue',
  updatedAt: '2026-09-23T00:00:00.000Z',
};
function Preview({
  readonly = false,
  fail = false,
  pending = false,
  populated = true,
}: {
  readonly?: boolean;
  fail?: boolean;
  pending?: boolean;
  populated?: boolean;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<PlanTool>('area');
  const [busy, setBusy] = useState(false);
  const api = useRef<PlanAreasApi | null>(null);
  if (!api.current) {
    let areas = populated ? [initial] : [];
    api.current = {
      load: () => Promise.resolve({ areas, canManageAreas: !readonly }),
      create: async (input) => {
        if (pending) return new Promise(() => undefined);
        if (fail) throw new Error('unavailable');
        const area = {
          ...initial,
          ...input,
          id: crypto.randomUUID(),
          code: `Ar.${String(areas.length + 1).padStart(2, '0')}`,
        };
        areas = [...areas, area];
        return area;
      },
      update: (id, input) => {
        if (pending) return new Promise(() => undefined);
        if (fail) return Promise.reject(new Error('unavailable'));
        const current = areas.find((a) => a.id === id) ?? initial;
        const area = {
          ...current,
          code: input.code ?? current.code,
          content: input.content ?? current.content,
          orientation: input.orientation ?? current.orientation,
          x: input.x ?? current.x,
          y: input.y ?? current.y,
          width: input.width ?? current.width,
          height: input.height ?? current.height,
          updatedAt: new Date().toISOString(),
        };
        areas = areas.map((a) => (a.id === id ? area : a));
        return Promise.resolve(area);
      },
      remove: (id) => {
        areas = areas.filter((a) => a.id !== id);
        return Promise.resolve();
      },
    };
  }
  return (
    <div
      ref={setHost}
      className="relative h-[800px] w-[1100px] max-w-full bg-white p-8"
    >
      <div className="relative h-[680px] w-full border border-[#e2e2e7] bg-[#fafafa]">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 700"
          aria-label="Example plan"
        >
          <path
            d="M80 70H920V630H80ZM80 250H920M300 70V630M620 70V630M300 400H620"
            fill="none"
            stroke="#72727e"
          />
        </svg>
        <PlanAreas
          api={api.current}
          fileId={null}
          tool={tool}
          panning={tool === 'hand'}
          externalBusy={false}
          drawerHost={host}
          beforeSelect={() => true}
          onBusyChange={setBusy}
          onActivateMove={() => {
            setTool('move');
          }}
        />
      </div>
      <div className="absolute bottom-5 left-4 z-30">
        <PlanToolbar
          tool={tool}
          canAdd={!readonly}
          canAddArea={!readonly}
          disabled={busy}
          onChange={setTool}
        />
      </div>
    </div>
  );
}
const meta = {
  title: 'Sites/Plan Areas',
  component: Preview,
  parameters: { layout: 'fullscreen' },
  args: {},
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Selected: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', {
        name: 'Select area Ar.01',
      }),
    );
  },
};
export const Viewer: Story = { ...Selected, args: { readonly: true } };
export const Menu: Story = {
  args: { populated: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Area drawing'));
  },
};
export const Armed: Story = {
  ...Menu,
  play: async (context) => {
    await Menu.play?.(context);
    await userEvent.click(
      within(context.canvasElement).getByRole('menuitem', { name: 'Floor' }),
    );
  },
};
async function createWithKeyboard(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByLabelText('Area drawing'));
  await userEvent.click(canvas.getByRole('menuitem', { name: 'Floor' }));
  await userEvent.keyboard('{Enter}{ArrowRight}{ArrowDown}{Enter}');
}
export const Drawing: Story = {
  args: { populated: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Area drawing'));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Floor' }));
    await userEvent.keyboard(
      '{Enter}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}',
    );
  },
};
export const Failure: Story = {
  play: async ({ canvasElement }) => {
    await createWithKeyboard(canvasElement);
  },
  args: { fail: true, populated: false },
};
export const Pending: Story = {
  play: async ({ canvasElement }) => {
    await createWithKeyboard(canvasElement);
  },
  args: { pending: true, populated: false },
};

/** @spec allocation-plan-area-transform REQ-005,007 */
export const ResizePreview: Story = {
  play: async (context) => {
    await Selected.play?.(context);
    const handle = within(context.canvasElement).getByRole('button', {
      name: 'Resize area bottom-right',
    });
    handle.focus();
    await userEvent.keyboard('{Enter}{ArrowRight}{ArrowRight}{ArrowDown}');
  },
};
export const ResizePending: Story = {
  args: { pending: true },
  play: async (context) => {
    await ResizePreview.play?.(context);
    await userEvent.keyboard('{Enter}');
  },
};
export const ResizeFailure: Story = {
  ...ResizePending,
  args: { fail: true },
};

/** @spec allocation-plan-area-auto-move REQ-001 */
export const CreatedInMoveMode: Story = {
  args: { populated: false },
  play: async ({ canvasElement }) => {
    await createWithKeyboard(canvasElement);
  },
};
