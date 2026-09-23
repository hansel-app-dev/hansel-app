import { isIPv4 } from 'node:net';

/** @spec sandbox-test-catalog REQ-001,002 */
export function selectCatalogEnvironment(
  runtime: 'test' | 'production',
  deployment: string | undefined,
  allowedOrigin: string,
): 'test' | 'production' {
  if (deployment === undefined) return runtime;
  if (deployment === 'production') return 'production';
  if (deployment !== 'sandbox')
    throw new Error('Unknown HANSEL_DEPLOYMENT_ENVIRONMENT');
  const url = new URL(allowedOrigin);
  if (
    url.protocol !== 'https:' ||
    !isIPv4(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Sandbox catalog requires an HTTPS IPv4 origin');
  return 'test';
}
