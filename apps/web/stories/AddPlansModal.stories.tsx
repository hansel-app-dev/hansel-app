/** @spec site-allocation-plans-add REQ-002, REQ-019..REQ-021 @figma 2057:3458, 2060:4943, 2220:17399 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AddPlansModal } from '../src/sites/AddPlansModal.js';

type AddPlansModalProps = ComponentProps<typeof AddPlansModal>;

const emptyCreate: AddPlansModalProps['createBatch'] = () =>
  Promise.resolve({ uploads: [] });
const emptyUpload: AddPlansModalProps['upload'] = () => Promise.resolve();

const meta = {
  title: 'Sites/Add Plans Modal',
  component: AddPlansModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Figma reference: Hansel App UI frame 2057:3458.',
      },
    },
  },
  args: {
    createBatch: emptyCreate,
    upload: emptyUpload,
    finalize: () => Promise.resolve(),
    onClose: () => undefined,
    onComplete: () => undefined,
  },
} satisfies Meta<typeof AddPlansModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const choosePlan = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const picker =
    canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
  if (!picker) throw new Error('Expected file picker');
  await userEvent.upload(
    picker,
    new File(['%PDF-'], 'HANSEL_L1_6054.pdf', {
      type: 'application/pdf',
    }),
  );
  await userEvent.click(canvas.getByRole('button', { name: 'Upload' }));
  return canvas;
};

const createSingleUpload: AddPlansModalProps['createBatch'] = () =>
  Promise.resolve({
    uploads: [
      {
        uploadId: '00000000-0000-4000-8000-000000000001',
        uploadUrl: 'https://uploads.example/plan',
        expiresAt: '2026-09-06T00:15:00.000Z',
        headers: {
          'content-type': 'application/pdf',
          'x-amz-checksum-sha256':
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        },
      },
    ],
  });

export const Uploading: Story = {
  args: {
    createBatch: createSingleUpload,
    upload: (_url, _file, _headers, options) => {
      options?.onProgress(45);
      return new Promise(() => undefined);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(canvas.getAllByText('45%')[0]).toBeVisible();
  },
};

export const Uploaded: Story = {
  args: {
    createBatch: createSingleUpload,
    upload: fn().mockResolvedValue(undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Done' })).toBeVisible();
  },
};
