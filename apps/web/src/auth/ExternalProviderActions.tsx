/** @spec google-local-auth REQ-001, REQ-003 */
import { useEffect, useState } from 'react';
import { ProviderAction } from '../design-system/index.js';

const providers = ['google', 'microsoft', 'apple'] as const;
type Provider = (typeof providers)[number];

export function ExternalProviderActions({
  intent,
  availableProviders,
}: {
  intent: 'login' | 'onboarding';
  availableProviders?: readonly Provider[];
}) {
  const [available, setAvailable] = useState<readonly Provider[]>([]);
  useEffect(() => {
    if (availableProviders) return;
    const controller = new AbortController();
    void fetch('/api/auth/providers', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Provider availability unavailable');
        const result: unknown = await response.json();
        if (
          !controller.signal.aborted &&
          result &&
          typeof result === 'object' &&
          'providers' in result &&
          Array.isArray(result.providers)
        ) {
          const enabled: unknown[] = result.providers;
          setAvailable(
            providers.filter((provider) => enabled.includes(provider)),
          );
        }
      })
      .catch(() => {
        /* Unavailable capabilities leave controls disabled. */
      });
    return () => {
      controller.abort();
    };
  }, [availableProviders]);
  return (
    <>
      {providers.map((provider) => {
        if (!(availableProviders ?? available).includes(provider))
          return <ProviderAction key={provider} provider={provider} disabled />;
        if (intent === 'login')
          return (
            <ProviderAction
              key={provider}
              provider={provider}
              href={`/auth/start/${provider}?intent=login`}
            />
          );
        return (
          <form key={provider} action={`/auth/start/${provider}`} method="post">
            <input type="hidden" name="intent" value="onboarding" />
            <input type="hidden" name="acceptsTerms" value="true" />
            <ProviderAction provider={provider} type="submit" />
          </form>
        );
      })}
    </>
  );
}
