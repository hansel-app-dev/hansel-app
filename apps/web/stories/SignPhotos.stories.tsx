import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignPhotos } from '../src/sites/SignPhotos.js';
import type { SignPhotosApi } from '../src/sites/sign-photos-api.js';
import { createSignPhotosApi } from '../src/sites/sign-photos-api.js';
import { userEvent, within, fn } from 'storybook/test';
const file = {
  id: '33e82388-a951-4d52-b6d6-0b5cde568763',
  filename: 'sign-photo.jpg',
  mediaType: 'image/jpeg' as const,
  byteSize: 1024,
  createdAt: '2026-09-15T00:00:00.000Z',
};
function Preview({
  empty = false,
  failure = false,
  readOnly = false,
  uploading = false,
  longList = false,
  network = false,
  deletePending = false,
}) {
  const api: SignPhotosApi = {
    list: () =>
      failure
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({
            photos: empty
              ? []
              : Array.from({ length: longList ? 30 : 3 }, (_, i) => ({
                  ...file,
                  id: `${file.id.slice(0, -2)}${String(i).padStart(2, '0')}`,
                })),
            nextCursor: null,
          }),
    initiate: () =>
      uploading
        ? new Promise(() => {
            /* Intentionally pending visual state. */
          })
        : Promise.reject(new Error('offline')),
    complete: () => Promise.resolve(file),
    download: () => Promise.resolve(),
    remove: () =>
      deletePending
        ? new Promise(() => {
            /* Pending deletion visual fixture. */
          })
        : Promise.resolve(),
    thumbnail: () =>
      Promise.resolve(
        new Blob(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="302" height="192"><rect width="302" height="192" fill="#d4d0cf"/><rect x="90" width="115" height="192" rx="40" fill="#e2b65b"/><text x="105" y="85" font-size="13">↑ Rooms</text><text x="105" y="125" font-size="13">Laundry</text></svg>',
          ],
          { type: 'image/svg+xml' },
        ),
      ),
  };
  return (
    <aside
      aria-label="Sign details"
      className="absolute right-0 top-[118px] bottom-10 flex w-[350px] max-w-full flex-col border-l border-[#e2e2e7] bg-white text-[#27272a]"
    >
      <div className="shrink-0 px-6 pt-6">
        <div className="mb-4 h-5 text-2xl leading-5 text-[#72727e]">×</div>
        <div className="h-10 rounded border border-[#e2e2e7] px-2 py-1 text-xl">
          Rg.01
        </div>
      </div>
      <div className="mt-3 flex h-[38px] shrink-0 gap-4 border-b border-[#e2e2e7] px-6 text-sm">
        <span className="py-2">General</span>
        <span className="py-2">Docs</span>
        <span className="border-b-[3px] border-[#27272a] py-2">Photos</span>
        <span className="py-2">Comments</span>
      </div>
      <SignPhotos
        api={network ? createSignPhotosApi('site', '') : api}
        signId="sign"
        canManage={!readOnly}
        onBusyChange={fn()}
      />
    </aside>
  );
}
const meta = {
  title: 'Sites/Sign Photos',
  component: Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Network: Story = { args: { network: true } };
export const Empty: Story = { args: { empty: true } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const Failure: Story = { args: { failure: true } };
export const LongList: Story = { args: { longList: true } };
export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const first = (
      await within(canvasElement).findAllByRole('button', { name: /Download/ })
    )[0];
    if (first) await userEvent.hover(first);
  },
};
export const Uploading: Story = {
  args: { uploading: true },
  play: async ({ canvasElement }) => {
    await userEvent.upload(
      within(canvasElement).getByLabelText('Upload photos'),
      new File(['image'], 'Photo.jpg', { type: 'image/jpeg' }),
    );
  },
};
export const UploadFailure: Story = {
  ...Uploading,
  args: { uploading: false },
};

export const Grid: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: 'Grid view' }),
    );
  },
};
export const DeleteConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const buttons = await within(canvasElement).findAllByRole('button', {
      name: /Delete sign-photo/,
    });
    if (buttons[0]) await userEvent.click(buttons[0]);
  },
};
export const DeletePending: Story = { args: { deletePending: true } };
