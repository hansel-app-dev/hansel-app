/** @spec onboarding REQ-086 @figma 52:607 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from '../src/design-system/index.js';
const options = [
  { id: 'manager', label: 'Manager' },
  { id: 'other', label: 'Other' },
];
const meta = {
  title: 'Design System/SelectField',
  component: SelectField,
  args: { label: 'Job title', options },
} satisfies Meta<typeof SelectField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const States: Story = {
  render: () => (
    <main className="grid gap-component-gap rounded-control bg-canvas p-workbench">
      <span className="sr-only" data-focus-start tabIndex={-1} />
      <h1 className="text-xl font-semibold">Select field</h1>
      <div className="grid min-w-80 gap-component-gap rounded-control bg-surface p-workbench shadow-control">
        <SelectField label="Job title" options={options} />
        <SelectField
          label="Selected job title"
          options={options}
          defaultValue="manager"
        />
        <SelectField
          error="Select your job title."
          label="Job title with error"
          options={options}
        />
        <div className="grid gap-component-gap">
          <SelectField
            label="Conditional job title"
            options={options}
            defaultValue="other"
          />
          <label className="grid gap-field-gap text-sm font-semibold">
            Other job title
            <input
              className="min-h-control rounded-control border border-control-border px-control-x py-control-y font-normal"
              defaultValue="Founder"
            />
          </label>
        </div>
        <SelectField disabled label="Disabled job title" options={options} />
      </div>
    </main>
  ),
};
