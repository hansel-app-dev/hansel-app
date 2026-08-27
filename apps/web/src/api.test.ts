import { describe, expect, it, vi } from 'vitest';
import { getHealth } from './api.js';

describe('getHealth [REQ-002]', () => {
  it('parses a successful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      );
    await expect(getHealth('https://api.example', fetcher)).resolves.toEqual({
      status: 'ok',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example/health');
  });

  it('rejects an unsuccessful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getHealth('', fetcher)).rejects.toThrow(
      'Health request failed with 503',
    );
  });
});
