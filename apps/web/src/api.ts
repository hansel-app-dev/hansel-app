import { healthResponseSchema, type HealthResponse } from '@hansel/contracts';

export async function getHealth(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<HealthResponse> {
  const response = await fetcher(`${baseUrl}/health`);
  if (!response.ok)
    throw new Error(`Health request failed with ${String(response.status)}`);
  return healthResponseSchema.parse(await response.json());
}
