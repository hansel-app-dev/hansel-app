/** @spec site-signage-schedule REQ-007, REQ-018, REQ-021 */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-non-null-assertion -- Known deterministic fixtures. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { SignageSchedule } from '../src/sites/SignageSchedule.js';
const now = '2026-09-06T00:00:00.000Z';
const sign = (id: string, signTypeId: string, code: string, comments = '') => ({
  id,
  signTypeId,
  code,
  quantity: 1,
  location: 'G001',
  content: 'FIRE SAFETY DIRECTORY',
  comments,
  createdAt: now,
  updatedAt: now,
});
const types = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Regulatory Signs',
    color: 'RED' as const,
    createdAt: now,
    updatedAt: now,
    quantityTotal: 3,
    signs: [
      sign(
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000010',
        'RS.101',
      ),
      sign(
        '00000000-0000-4000-8000-000000000012',
        '00000000-0000-4000-8000-000000000010',
        'RS.102',
        'Client to advise location',
      ),
      sign(
        '00000000-0000-4000-8000-000000000013',
        '00000000-0000-4000-8000-000000000010',
        'RS.103',
      ),
    ],
  },
];
const meta = {
  title: 'Sites/Signage Schedule',
  component: SignageSchedule,
  args: {
    initial: { canManageSigns: true, signTypes: types },
    createType: async () => types[0]!,
    updateType: async (type) => type,
    createSign: async () => types[0]!.signs[0]!,
    updateSign: async (sign) => sign,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignageSchedule>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const ReferenceGrid: Story = {
  decorators: [
    (Story) => (
      <div className="ml-[300px] px-8 pt-[151px] bg-[#fafafa] min-h-screen">
        <Story />
      </div>
    ),
  ],
};
export const Empty: Story = {
  args: { initial: { canManageSigns: true, signTypes: [] } },
};
export const OneGroup: Story = {};
export const MultiGroup: Story = {
  args: {
    initial: {
      canManageSigns: true,
      signTypes: [
        ...types,
        {
          ...types[0]!,
          id: '00000000-0000-4000-8000-000000000020',
          name: 'Overhead Wayfinding',
          color: 'TEAL',
          signs: [],
          quantityTotal: 0,
        },
      ],
    },
  },
};
export const ReadOnly: Story = {
  args: { initial: { canManageSigns: false, signTypes: types } },
};
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole('searchbox'),
      'RS.102',
    );
  },
};
export const Filtered: Story = {
  ...MultiGroup,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Filter', { exact: true }));
    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'Regulatory Signs' }),
    );
  },
};
export const Sorted: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.selectOptions(
      within(canvasElement).getByRole('combobox', { name: 'Sort signs' }),
      'ZA',
    );
  },
};
export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Collapse Regulatory Signs',
      }),
    );
  },
};
export const NewTypeDraftAndError: Story = {
  args: { createType: async () => Promise.reject(new Error('duplicate')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: /New sign type/ }),
    );
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'New sign type name' }),
      'Duplicate',
    );
    await userEvent.tab();
    await canvas.findByText(/Could not add this sign type/);
  },
};
export const NewSignDraftAndError: Story = {
  args: { createSign: async () => Promise.reject(new Error('duplicate')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Add sign/ }));
    await userEvent.type(
      canvas.getByRole('textbox', { name: /New sign code/ }),
      'RS.104',
    );
    await userEvent.tab();
    await canvas.findByText(/Could not add this sign/);
  },
};
export const CellEditing: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', {
      name: 'RS.101 location',
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'Lobby');
  },
};
export const Saving: Story = {
  args: { updateSign: () => new Promise(() => undefined) },
  play: async (context) => {
    await CellEditing.play?.(context);
    await userEvent.tab();
  },
};
export const Conflict: Story = {
  args: { updateSign: async () => Promise.reject(new Error('conflict')) },
  play: async (context) => {
    await CellEditing.play?.(context);
    await userEvent.tab();
    await within(context.canvasElement).findByText(/Could not save this value/);
  },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Zoom200Percent: Story = {
  decorators: [
    (Story) => (
      <div style={{ zoom: 2 }}>
        <Story />
      </div>
    ),
  ],
};
