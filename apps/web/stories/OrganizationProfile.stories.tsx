/** @spec onboarding-organization-profile REQ-001, REQ-014 @figma 11:409 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  countryOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';
import type { OrganizationProfilePageResponse } from '@hansel/contracts';
import { OrganizationProfile } from '../src/onboarding/OrganizationProfile.js';

const page: OrganizationProfilePageResponse = {
  submissionKey: 'x'.repeat(43),
  countries: countryOptions,
  industries: [...industryOptions],
  placesByIndustry: Object.fromEntries(
    Object.entries(placeServiceOptions).map(([key, values]) => [
      key,
      [...values],
    ]),
  ),
  sizes: [...organizationSizeOptions],
};
const meta = {
  title: 'Onboarding/Organization Profile',
  component: OrganizationProfile,
  args: {
    loadProfile: () => Promise.resolve(page),
    submitProfile: () => Promise.resolve({ nextStep: 'discovery' as const }),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Figma reference: 11:409' } },
  },
} satisfies Meta<typeof OrganizationProfile>;
export default meta;
type Story = StoryObj<typeof meta>;
async function completeForm(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByLabelText('Organization'), 'Hansel');
  await userEvent.selectOptions(canvas.getByLabelText('Country'), 'AU');
  await userEvent.selectOptions(
    canvas.getByLabelText('Industry or sector'),
    'healthcare',
  );
  await userEvent.selectOptions(
    canvas.getByLabelText('Type of place or service'),
    'clinics',
  );
  await userEvent.selectOptions(
    canvas.getByLabelText('Size'),
    'employees_11_50',
  );
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
}
export const Normal: Story = {};
export const DependentOptions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByLabelText('Industry or sector'),
      'healthcare',
    );
    await expect(canvas.getByRole('option', { name: 'Clinics' })).toBeVisible();
  },
};
export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }));
    await expect(canvas.getAllByRole('alert')[0]).toBeVisible();
  },
};
export const LoadFailure: Story = {
  args: { loadProfile: () => Promise.reject(new Error('failed')) },
};
export const Submitting: Story = {
  args: {
    submitProfile: () =>
      new Promise<{ nextStep: 'discovery' }>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    await completeForm(canvasElement);
    await expect(
      within(canvasElement).getByRole('button', { name: 'Next' }),
    ).toBeDisabled();
  },
};
