/** @spec sites-add-new REQ-001..REQ-009, REQ-017, REQ-020 @figma 2029:1630 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AddSiteModal } from '../src/sites/AddSiteModal.js';

const meta = {
  title: 'Sites/Add Site Modal',
  component: AddSiteModal,
  args: {
    canInviteMembers: true,
    creator: {
      email: 'owner@example.com',
      displayName: 'Nabin Singh',
      initials: 'NS',
    },
    createSite: () =>
      Promise.resolve({
        siteId: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
        destination: '/sites/ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9/activity',
      }),
    members: [
      {
        email: 'alex@example.com',
        displayName: 'Alex Morgan',
        initials: 'AM',
      },
    ],
    onClose: () => undefined,
    onCreated: () => undefined,
    organizationName: 'Hansel',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Figma reference: Hansel App UI frame 2029:1630',
      },
    },
  },
} satisfies Meta<typeof AddSiteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepOne: Story = {};

export const StepTwo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByText('Invite team members')).toBeVisible();
  },
};

export const FreePlan: Story = {
  args: { canInviteMembers: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByText('Invite team members')).toBeVisible();
  },
};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const InternalAndExternalMembers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    const email = canvas.getByLabelText('Email or team member');
    await userEvent.type(email, 'alex@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await userEvent.type(email, 'guest@example.com');
    await userEvent.selectOptions(canvas.getByLabelText('Role'), 'VIEWER');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(canvas.getByText(/alex@example.com · Internal/)).toBeVisible();
    await expect(canvas.getByText('External')).toBeVisible();
  },
};

export const PaidSeatWarning: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await userEvent.type(
      canvas.getByLabelText('Email or team member'),
      'guest@example.com',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'paid seat to be an administrator',
    );
  },
};

export const PendingCreation: Story = {
  args: { createSite: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Create site' }));
    await expect(
      canvas.getByRole('button', { name: 'Creating…' }),
    ).toBeDisabled();
  },
};

export const ServerFailure: Story = {
  args: { createSite: () => Promise.reject(new Error('unavailable')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Create site' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      "We couldn't create the site",
    );
  },
};
