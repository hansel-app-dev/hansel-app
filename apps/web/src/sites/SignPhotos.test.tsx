import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignPhotos } from './SignPhotos.js';
afterEach(cleanup);
const photo = { id: '33e82388-a951-4d52-b6d6-0b5cde568763', filename: 'sign.jpg', mediaType: 'image/jpeg' as const, byteSize: 10, createdAt: '2026-09-15T00:00:00.000Z' };
const download = vi.fn().mockResolvedValue(undefined);
const api = { list: vi.fn().mockResolvedValue({ photos: [photo], nextCursor: null }), initiate: vi.fn(), complete: vi.fn(), thumbnail: vi.fn().mockResolvedValue(new Blob()), remove: vi.fn(), download };
it('sign-photos REQ-004..008: shows photos, toggles views and downloads; no preview or library action', async () => {
  render(<SignPhotos api={api} signId="sign" canManage onBusyChange={vi.fn()} />);
  expect(await screen.findByText('sign.jpg')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Download sign.jpg' }));
  expect(download).toHaveBeenCalledWith('sign', photo.id, photo.filename);
  expect(screen.getByRole('button', { name: 'Library files' })).toBeDisabled();
});
it('sign-photos REQ-007: PDF is rejected without uploading', async () => {
  render(<SignPhotos api={api} signId="sign" canManage onBusyChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Upload photos'), { target: { files: [new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' })] } });
  expect(await screen.findByText(/Choose a nonempty PNG or JPG/)).toBeInTheDocument();
  expect(api.initiate).not.toHaveBeenCalled();
});
