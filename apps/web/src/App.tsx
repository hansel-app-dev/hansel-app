import { useState } from 'react';
import {
  createOnboardingAccount,
  resendOnboardingVerification,
  verifyOnboardingEmail,
} from './api.js';
import { OnboardingStart } from './onboarding/OnboardingStart.js';
import { VerifyEmail } from './onboarding/VerifyEmail.js';
import './styles.css';

const verificationEmailKey = 'hansel.verificationEmail';

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
  const [verificationEmail, setVerificationEmail] = useState(
    () => window.sessionStorage.getItem(verificationEmailKey) ?? '',
  );
  if (path === '/onboarding') {
    return (
      <OnboardingStart
        createAccount={(input) => createOnboardingAccount(input, apiUrl)}
        onCreated={(email) => {
          const normalizedEmail = email.trim().toLowerCase();
          window.sessionStorage.setItem(verificationEmailKey, normalizedEmail);
          setVerificationEmail(normalizedEmail);
          window.history.pushState({}, '', '/onboarding/verify-email');
        }}
      />
    );
  }
  if (path === '/onboarding/verify-email') {
    return (
      <VerifyEmail
        email={verificationEmail}
        resendAvailableInSeconds={verificationEmail ? 60 : 0}
        verify={(input) => verifyOnboardingEmail(input, apiUrl)}
        resend={(input) => resendOnboardingVerification(input, apiUrl)}
        onVerified={() => {
          window.sessionStorage.removeItem(verificationEmailKey);
        }}
      />
    );
  }
  return <Home />;
}
