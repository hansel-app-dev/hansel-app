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
    commit: () => Promise.resolve(),
    onClose: () => undefined,
    onComplete: () => undefined,
  },
} satisfies Meta<typeof AddPlansModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText('Allocation name'),
      'Ground floor',
    );
    await userEvent.upload(
      canvas.getByLabelText('Choose allocation files'),
      new File(['%PDF-'], 'HANSEL_L1_6054.pdf', { type: 'application/pdf' }),
    );
    await expect(
      canvas.getByRole('list', { name: 'Allocation files' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled();
  },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const choosePlan = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.type(
    canvas.getByLabelText('Allocation name'),
    'Ground floor',
  );
  const picker =
    canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
  if (!picker) throw new Error('Expected file picker');
  await userEvent.upload(
    picker,
    new File(['%PDF-'], 'HANSEL_L1_6054.pdf', {
      type: 'application/pdf',
    }),
  );
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
  return canvas;
};

const createSingleUpload: AddPlansModalProps['createBatch'] = () =>
  Promise.resolve({
    uploads: [
      {
        uploadId: '00000000-0000-4000-8000-000000000001',
        uploadUrl: 'https://uploads.example/plan',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
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
    await expect(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
  },
};

export const InvalidName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByLabelText('Allocation name'));
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
  },
};
export const Verifying: Story = {
  args: {
    createBatch: createSingleUpload,
    finalize: () => new Promise(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(canvas.getByText(/Verifying/)).toBeVisible();
  },
};
export const UploadFailed: Story = {
  args: {
    createBatch: createSingleUpload,
    upload: () => Promise.reject(new Error('fixture failure')),
  },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(canvas.getByRole('button', { name: /Retry/ })).toBeVisible();
  },
};
export const CreationFailed: Story = {
  args: {
    createBatch: createSingleUpload,
    commit: () => Promise.reject(new Error('fixture failure')),
  },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    );
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};
export const ConfirmCancellation: Story = {
  args: { createBatch: createSingleUpload },
  play: async ({ canvasElement }) => {
    const canvas = await choosePlan(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(
      canvas.getByRole('button', { name: 'Discard allocation' }),
    ).toBeVisible();
  },
};
export const MultipleFiles: Story = {
  args: {
    createBatch: async (input) => {
      const single = await createSingleUpload(input);
      const intent = single.uploads[0];
      if (!intent) throw new Error('Expected fixture intent');
      return {
        uploads: input.files.map((_, i) => ({
          ...intent,
          uploadId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        })),
      };
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText('Allocation name'),
      'Ground floor',
    );
    const picker = canvas.getByLabelText('Choose allocation files');
    await userEvent.upload(
      picker,
      ['Ground.pdf', 'First.pdf', 'Second.pdf'].map(
        (name) => new File(['%PDF-'], name, { type: 'application/pdf' }),
      ),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
  },
};

/** @spec library-files REQ-006,013 */
import { libraryApi } from './LibraryFiles.stories.js';
export const Library: Story = {
  args: { library: { files: libraryApi, create: () => Promise.resolve() } },
};
export const LibrarySelected: Story = {
  ...Library,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Library files' }),
    );
    const body = within(document.body);
    await userEvent.click(
      await body.findByRole('radio', { name: 'Ground floor.pdf' }),
    );
    await userEvent.click(
      body.getByRole('button', { name: 'Select plan file' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
  },
};
