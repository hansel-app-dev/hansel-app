import { useState } from 'react';
import {
  createOnboardingAccount,
  resendOnboardingVerification,
  verifyOnboardingEmail,
  submitPersonalProfile,
  loadPlanSelection,
  selectOnboardingPlan,
} from './api.js';
import { AboutYou } from './onboarding/AboutYou.js';
import { OnboardingStart } from './onboarding/OnboardingStart.js';
import { VerifyEmail } from './onboarding/VerifyEmail.js';
import { PlanSelection } from './onboarding/PlanSelection.js';
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
  openExternal = window.location.assign.bind(window.location),
}: {
  apiUrl?: string;
  path?: string;
  openExternal?: (destination: string) => void;
}) {
  const [verificationEmail, setVerificationEmail] = useState(
    () => window.sessionStorage.getItem(verificationEmailKey) ?? '',
  );
  const [currentPath, setCurrentPath] = useState(path);
  const navigate = (destination: string) => {
    window.history.pushState({}, '', destination);
    setCurrentPath(destination);
  };
  if (currentPath === '/onboarding') {
    return (
      <OnboardingStart
        createAccount={(input) => createOnboardingAccount(input, apiUrl)}
        onCreated={(email) => {
          const normalizedEmail = email.trim().toLowerCase();
          window.sessionStorage.setItem(verificationEmailKey, normalizedEmail);
          setVerificationEmail(normalizedEmail);
          navigate('/onboarding/verify-email');
        }}
      />
    );
  }
  if (currentPath === '/onboarding/verify-email') {
    return (
      <VerifyEmail
        email={verificationEmail}
        resendAvailableInSeconds={verificationEmail ? 60 : 0}
        verify={(input) => verifyOnboardingEmail(input, apiUrl)}
        resend={(input) => resendOnboardingVerification(input, apiUrl)}
        onVerified={() => {
          window.sessionStorage.removeItem(verificationEmailKey);
          navigate('/onboarding/about-you');
        }}
      />
    );
  }
  if (currentPath === '/onboarding/about-you') {
    return (
      <AboutYou
        submitProfile={(input) => submitPersonalProfile(input, apiUrl)}
        onCompleted={() => {
          navigate('/onboarding/plan-selection');
        }}
      />
    );
  }
  if (currentPath === '/onboarding/plan-selection') {
    return (
      <PlanSelection
        loadPlans={() => loadPlanSelection(apiUrl)}
        selectPlan={(priceId) => selectOnboardingPlan(priceId, apiUrl)}
        onCompleted={(result) => {
          if (result.nextStep === 'contact-sales')
            openExternal(result.destination);
          else navigate(`/onboarding/${result.nextStep}`);
        }}
      />
    );
  }
  return <Home />;
}
