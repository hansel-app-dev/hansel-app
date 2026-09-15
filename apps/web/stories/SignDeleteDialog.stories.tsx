import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignDeleteDialog } from '../src/sites/SignDeleteDialog.js';

function Preview({
  code = 'Rg.01',
  pending = false,
  error = '',
  conflict = false,
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <div className="pl-[300px] pt-[119px] max-md:pl-0">
      <section
        ref={setHost}
        className="relative h-[calc(100dvh-119px)] bg-white"
      >
        <div className="grid h-full place-items-center text-2xl">
          Allocation plan
        </div>
        <aside
          aria-label="Sign details"
          className="absolute right-0 top-0 bottom-10 w-[350px] max-w-full border-l bg-white p-6"
        >
          {code}
        </aside>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="absolute bottom-2 left-4"
        >
          Open confirmation
        </button>
        {host && open && (
          <SignDeleteDialog
            code={code}
            host={host}
            pending={pending}
            error={error}
            conflict={conflict}
            onCancel={() => {
              setOpen(false);
            }}
            onConfirm={() => {
              setOpen(false);
            }}
            onReload={() => {
              setOpen(false);
            }}
          />
        )}
      </section>
    </div>
  );
}
const meta = {
  title: 'Sites/Sign Delete Dialog',
  component: Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirmation: Story = {};
export const Pending: Story = { args: { pending: true } };
export const Failure: Story = {
  args: { error: 'We couldn’t delete this sign. Please try again.' },
};
export const Conflict: Story = {
  args: { error: 'This sign changed. Reload before deleting.', conflict: true },
};
export const LongCode: Story = {
  args: { code: 'VERY-LONG-SIGN-CODE-01234567890123456789' },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
