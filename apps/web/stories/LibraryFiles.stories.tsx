/** @spec library-files REQ-013 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LibraryFile } from '@hansel/contracts';
import {
  LibraryFileList,
  LibraryFilePicker,
  LibraryFilesPage,
} from '../src/sites/LibraryFiles.js';
import type { LibraryFilesApi } from '../src/sites/library-files-api.js';
const files = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    filename: 'Ground floor.pdf',
    mediaType: 'application/pdf',
    byteSize: 2048,
    uploadedBy: 'John Doe',
    createdAt: '2026-09-27T00:00:00Z',
    sourceSite: {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Building A',
    },
    hasThumbnail: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    filename: 'Entrance.png',
    mediaType: 'image/png',
    byteSize: 1024,
    uploadedBy: 'Alex Smith',
    createdAt: '2026-09-26T00:00:00Z',
    sourceSite: {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Building A',
    },
    hasThumbnail: true,
  },
] satisfies [LibraryFile, LibraryFile];
export const libraryApi: LibraryFilesApi = {
  list: (query) =>
    Promise.resolve({
      files: files.filter(
        (file) =>
          (query.kind === 'all' ||
            (query.kind === 'image'
              ? file.mediaType.startsWith('image/')
              : file.mediaType === 'application/pdf')) &&
          file.filename.toLowerCase().includes(query.q.toLowerCase()),
      ),
      nextCursor: null,
    }),
  download: () => Promise.resolve(),
  thumbnail: () => Promise.resolve(new Blob()),
  link: () => Promise.resolve({ items: [] }),
  createPlan: () =>
    Promise.reject(new Error('Use the library-backed Add plans story')),
};
const meta = {
  title: 'Libraries/Files',
  component: LibraryFileList,
  args: { api: libraryApi },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LibraryFileList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loaded: Story = {};
export const Empty: Story = {
  args: {
    api: {
      ...libraryApi,
      list: () => Promise.resolve({ files: [], nextCursor: null }),
    },
  },
};
export const Loading: Story = {
  args: { api: { ...libraryApi, list: () => new Promise(() => undefined) } },
};
export const Failure: Story = {
  args: {
    api: {
      ...libraryApi,
      list: () => Promise.reject(new Error('Unavailable')),
    },
  },
};
export const LongNames: Story = {
  args: {
    api: {
      ...libraryApi,
      list: () =>
        Promise.resolve({
          files: [
            {
              ...files[0],
              filename:
                'Ground floor reference drawing with a very long descriptive name.pdf',
            },
          ],
          nextCursor: null,
        }),
    },
  },
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const Zoom200: Story = {
  decorators: [
    (Story) => (
      <div style={{ zoom: 2 }}>
        <Story />
      </div>
    ),
  ],
};
export const SinglePicker: Story = {
  render: () => (
    <LibraryFilePicker
      api={libraryApi}
      kind="all"
      multiple={false}
      onSelect={() => Promise.resolve()}
      onClose={() => undefined}
    />
  ),
};
export const MultiplePicker: Story = {
  render: () => (
    <LibraryFilePicker
      api={libraryApi}
      kind="image"
      multiple
      onSelect={() => Promise.resolve()}
      onClose={() => undefined}
    />
  ),
};
export const PickerFailure: Story = {
  render: () => (
    <LibraryFilePicker
      api={libraryApi}
      kind="all"
      multiple
      onSelect={() => Promise.reject(new Error('Unavailable'))}
      onClose={() => undefined}
    />
  ),
};
export const Page: Story = {
  render: () => (
    <LibraryFilesPage
      api={libraryApi}
      loadDashboard={() =>
        Promise.resolve({
          viewer: {
            displayName: 'John Doe',
            initials: 'JD',
            roleLabel: 'Owner',
          },
        })
      }
      logout={() => Promise.resolve()}
    />
  ),
};
