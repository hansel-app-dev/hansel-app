import { createOnboardingAccount } from './api.js';
import { OnboardingStart } from './onboarding/OnboardingStart.js';
import './styles.css';

function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas text-content">
      <h1 className="text-4xl font-semibold tracking-tight">Hansel</h1>
    </main>
  );
}

export function App({
  apiUrl = '',
  path = window.location.pathname,
}: {
  apiUrl?: string;
  path?: string;
}) {
  if (path === '/onboarding') {
    return (
      <OnboardingStart
        createAccount={(input) => createOnboardingAccount(input, apiUrl)}
      />
    );
  }
  return <Home />;
}
