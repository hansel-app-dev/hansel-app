/** @spec user-login REQ-001..REQ-003, REQ-008, REQ-019, REQ-022 @figma 38:528 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { LoginAuthenticationError } from '../src/api.js';
import { Login, type LoginProps } from '../src/auth/Login.js';

const successfulLogin: LoginProps['login'] = () =>
  Promise.resolve({ destination: '/dashboard' });

const meta = {
  title: 'Authentication/Login',
  component: Login,
  args: {
    login: successfulLogin,
  },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Figma reference: 38:528' } },
  },
} satisfies Meta<typeof Login>;

export default meta;
type Story = StoryObj<typeof meta>;

async function submit(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Email'), 'owner@example.com');
  await userEvent.type(canvas.getByLabelText('Password'), 'password');
  await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
  return canvas;
}

export const Default: Story = {};

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await expect(
      canvas.getByText('Enter a valid email address.'),
    ).toBeVisible();
    await expect(canvas.getByText('Enter your password.')).toBeVisible();
  },
};

export const AuthenticationError: Story = {
  args: { login: () => Promise.reject(new LoginAuthenticationError()) },
  play: async ({ canvasElement }) => {
    const canvas = await submit(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      "We couldn't log you in. Check your details and try again.",
    );
  },
};

export const TemporaryFailure: Story = {
  args: { login: () => Promise.reject(new Error('unavailable')) },
  play: async ({ canvasElement }) => {
    const canvas = await submit(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Login is temporarily unavailable. Please try again.',
    );
  },
};

export const Submitting: Story = {
  args: { login: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    const canvas = await submit(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Log in' })).toBeDisabled();
  },
};
