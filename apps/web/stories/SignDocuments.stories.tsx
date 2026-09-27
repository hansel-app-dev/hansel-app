import { libraryApi } from './LibraryFiles.stories.js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignDocuments } from '../src/sites/SignDocuments.js';
import type { SignDocumentsApi } from '../src/sites/sign-documents-api.js';
import { createSignDocumentsApi } from '../src/sites/sign-documents-api.js';
import { userEvent, within, fn } from 'storybook/test';
const file = {
  id: '33e82388-a951-4d52-b6d6-0b5cde568763',
  filename: 'RegSign_Specs_010626.pdf',
  mediaType: 'application/pdf' as const,
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
  library = false,
}) {
  const api: SignDocumentsApi = {
    ...(library
      ? {
          library: {
            files: libraryApi,
            link: () => Promise.resolve({ items: [file] }),
          },
        }
      : {}),
    list: () =>
      failure
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({
            documents: empty
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
  };
  return (
    <aside
      aria-label="Sign details"
      className="absolute right-0 top-[119px] bottom-10 flex w-[350px] max-w-full flex-col border-l border-[#e2e2e7] bg-white text-[#27272a]"
    >
      <div className="shrink-0 px-6 pt-6">
        <div className="mb-4 h-5 text-2xl leading-5 text-[#72727e]">×</div>
        <div className="h-10 rounded border border-[#e2e2e7] px-2 py-1 text-xl">
          Rg.01
        </div>
      </div>
      <div className="mt-3 flex h-[38px] shrink-0 gap-4 border-b border-[#e2e2e7] px-6 text-sm">
        <span className="py-2">General</span>
        <span className="border-b-[3px] border-[#27272a] py-2">Docs</span>
        <span className="py-2">Photos</span>
        <span className="py-2">Comments</span>
      </div>
      <SignDocuments
        api={network ? createSignDocumentsApi('site', '') : api}
        signId="sign"
        canManage={!readOnly}
        onBusyChange={fn()}
      />
    </aside>
  );
}
const meta = {
  title: 'Sites/Sign Documents',
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
      within(canvasElement).getByLabelText('Upload documents'),
      new File(['%PDF-1.7'], 'Specification.pdf', { type: 'application/pdf' }),
    );
  },
};
export const UploadFailure: Story = {
  ...Uploading,
  args: { uploading: false },
};

/** @spec library-files REQ-005,013 */
export const Library: Story = { args: { library: true } };
