import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlanSignsApi } from './sites/plan-signs-api.js';
import type { DashboardResponse } from '@hansel/contracts';
import {
  createOnboardingAccount,
  resendOnboardingVerification,
  verifyOnboardingEmail,
  loadPersonalProfile,
  submitPersonalProfile,
  loadPlanSelection,
  selectOnboardingPlan,
  loadOrganizationProfile,
  submitOrganizationProfile,
  loadDiscovery,
  completeDiscovery,
  OnboardingSessionExpiredError,
  loadDashboard,
  logoutDashboard,
  DashboardAuthenticationRequiredError,
  login as loginWithPassword,
  requestPasswordRecovery,
  resetPassword,
  createSite,
  loadSiteActivity,
  loadSiteActivityPage,
  createSiteComment,
  SiteActivityDisabledError,
  SiteActivityNotFoundError,
  loadAllocationPlans,
  loadAllocationPlanContent,
  createAllocationPlanDraft,
  commitAllocationPlanDraft,
  uploadAllocationPlan,
  verifyAllocationPlanDraft,
  loadSites,
  loadSiteCoverImage,
  loadSignageSchedule,
  createSignType,
  updateSignType,
  createSign,
  updateSign,
} from './api.js';
import { ForgotPassword } from './auth/ForgotPassword.js';
import { Login } from './auth/Login.js';
import { ResetPassword } from './auth/ResetPassword.js';
import { AboutYou } from './onboarding/AboutYou.js';
import { OnboardingStart } from './onboarding/OnboardingStart.js';
import { VerifyEmail } from './onboarding/VerifyEmail.js';
import { PlanSelection } from './onboarding/PlanSelection.js';
import { OrganizationProfile } from './onboarding/OrganizationProfile.js';
import { Discovery } from './onboarding/Discovery.js';
import { Dashboard } from './dashboard/Dashboard.js';
import { Sites } from './sites/Sites.js';
import { uploadSiteCoverImage } from './sites/upload-cover-image.js';
import {
  SiteActivity,
  SiteAllocationPlans,
  SiteSignageSchedule,
} from './sites/SiteActivity.js';
import './styles.css';

const verificationEmailKey = 'hansel.verificationEmail';
const passwordRecoveryEmailKey = 'hansel.passwordRecoveryEmail';

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
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState(
    () => window.sessionStorage.getItem(passwordRecoveryEmailKey) ?? '',
  );
  const [currentPath, setCurrentPath] = useState(path);
  const [loginReady, setLoginReady] = useState(path !== '/login');
  const [dashboardCache, setDashboardCache] =
    useState<DashboardResponse | null>(null);
  const dashboardCacheRef = useRef<DashboardResponse | null>(null);
  const dashboardRequestRef = useRef<Promise<DashboardResponse> | null>(null);
  useEffect(() => {
    if (path !== '/onboarding' && path !== '/onboarding/verify-email') return;
    const hasSessionHint = document.cookie
      .split(';')
      .some((part) => part.trim().startsWith('hansel_onboarding_csrf='));
    if (!hasSessionHint) return;
    let active = true;
    void loadPersonalProfile(apiUrl)
      .then(() => {
        if (!active) return;
        window.sessionStorage.removeItem(verificationEmailKey);
        window.history.replaceState({}, '', '/onboarding/about-you');
        setCurrentPath('/onboarding/about-you');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [apiUrl, path]);
  useEffect(() => {
    if (currentPath !== '/login') return;
    setLoginReady(false);
    let active = true;
    void loadDashboard(apiUrl)
      .then(() => {
        if (!active) return;
        window.history.replaceState({}, '', '/dashboard');
        setCurrentPath('/dashboard');
      })
      .catch(() => {
        if (active) setLoginReady(true);
      });
    return () => {
      active = false;
    };
  }, [apiUrl, currentPath]);
  useEffect(() => {
    const followBrowserHistory = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', followBrowserHistory);
    return () => {
      window.removeEventListener('popstate', followBrowserHistory);
    };
  }, []);
  const navigate = (destination: string) => {
    window.history.pushState({}, '', destination);
    setCurrentPath(destination);
  };
  const returnToOnboarding = () => {
    window.history.replaceState({}, '', '/onboarding');
    setCurrentPath('/onboarding');
  };
  const returnToLogin = () => {
    dashboardCacheRef.current = null;
    setDashboardCache(null);
    window.history.replaceState({}, '', '/login');
    setCurrentPath('/login');
  };
  const handleSessionExpiry = (error: unknown): never => {
    if (error instanceof OnboardingSessionExpiredError) returnToOnboarding();
    throw error;
  };
  const loadAuthenticatedViewer = useCallback(async () => {
    if (dashboardCacheRef.current) return dashboardCacheRef.current;
    if (dashboardRequestRef.current) return dashboardRequestRef.current;
    const request = loadDashboard(apiUrl);
    dashboardRequestRef.current = request;
    try {
      const response = await request;
      dashboardCacheRef.current = response;
      setDashboardCache(response);
      return response;
    } catch (error) {
      if (error instanceof DashboardAuthenticationRequiredError)
        returnToLogin();
      throw error;
    } finally {
      dashboardRequestRef.current = null;
    }
  }, [apiUrl]);
  const logoutAuthenticatedViewer = async () => {
    await logoutDashboard(apiUrl);
    dashboardCacheRef.current = null;
    setDashboardCache(null);
    window.sessionStorage.removeItem(verificationEmailKey);
    returnToLogin();
  };
  const loadAuthenticatedCover = useCallback(
    (siteId: string, signal: AbortSignal) =>
      loadSiteCoverImage(siteId, apiUrl, signal).catch((error: unknown) => {
        if (error instanceof DashboardAuthenticationRequiredError)
          returnToLogin();
        throw error;
      }),
    [apiUrl],
  );
  const handleApplicationSession = <T,>(operation: Promise<T>) =>
    operation.catch((error: unknown) => {
      if (error instanceof DashboardAuthenticationRequiredError)
        returnToLogin();
      throw error;
    });
  if (currentPath === '/dashboard') {
    return (
      <Dashboard
        loadDashboard={loadAuthenticatedViewer}
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
      />
    );
  }
  if (currentPath === '/sites') {
    return (
      <Sites
        loadCoverImage={loadAuthenticatedCover}
        uploadCoverImage={(siteId, file) =>
          handleApplicationSession(uploadSiteCoverImage(siteId, file, apiUrl))
        }
        coverImageEnabled={!import.meta.env.PROD}
        createSite={(input) =>
          handleApplicationSession(createSite(input, apiUrl))
        }
        loadDashboard={loadAuthenticatedViewer}
        loadSites={async () => {
          await loadAuthenticatedViewer();
          return handleApplicationSession(loadSites(apiUrl));
        }}
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
      />
    );
  }
  const siteActivityMatch = /^\/sites\/([0-9a-f-]{36})\/activity$/.exec(
    currentPath,
  );
  const signageMatch = /^\/sites\/([0-9a-f-]{36})\/signage-schedule$/.exec(
    currentPath,
  );
  if (signageMatch?.[1]) {
    const siteId = signageMatch[1];
    return (
      <SiteSignageSchedule
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
        loadDashboard={loadAuthenticatedViewer}
        loadSite={() =>
          handleApplicationSession(loadSiteActivity(siteId, apiUrl))
        }
        loadSites={() => handleApplicationSession(loadSites(apiUrl))}
        loadSignageSchedule={() =>
          handleApplicationSession(loadSignageSchedule(siteId, apiUrl))
        }
        createSignType={(name) =>
          handleApplicationSession(createSignType(siteId, name, apiUrl))
        }
        updateSignType={(type, name) =>
          handleApplicationSession(updateSignType(siteId, type, name, apiUrl))
        }
        createSign={(typeId, code) =>
          handleApplicationSession(createSign(siteId, typeId, code, apiUrl))
        }
        updateSign={(sign, field, value) =>
          handleApplicationSession(
            updateSign(siteId, sign, field, value, apiUrl),
          )
        }
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
      />
    );
  }
  if (siteActivityMatch?.[1]) {
    const siteId = siteActivityMatch[1];
    return (
      <SiteActivity
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
        loadActivity={() =>
          handleApplicationSession(loadSiteActivity(siteId, apiUrl))
        }
        loadDashboard={loadAuthenticatedViewer}
        loadSiteActivityPage={(cursor) =>
          handleApplicationSession(
            loadSiteActivityPage(siteId, cursor, apiUrl),
          ).catch((error: unknown) => {
            if (error instanceof SiteActivityDisabledError) return null;
            throw error;
          })
        }
        createSiteComment={(text) =>
          handleApplicationSession(createSiteComment(siteId, text, apiUrl))
        }
        isSiteActivityNotFound={(error) =>
          error instanceof SiteActivityNotFoundError
        }
        loadSites={() => handleApplicationSession(loadSites(apiUrl))}
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
      />
    );
  }
  const siteAllocationsMatch = /^\/sites\/(?:([^/]*)\/)?allocations$/.exec(
    currentPath,
  );
  const siteAllocationPreviewMatch =
    /^\/sites\/([0-9a-f-]{36})\/allocations\/([0-9a-f-]{36})$/.exec(
      currentPath,
    );
  if (siteAllocationPreviewMatch?.[1] && siteAllocationPreviewMatch[2]) {
    const siteId = siteAllocationPreviewMatch[1];
    const planId = siteAllocationPreviewMatch[2];
    return (
      <SiteAllocationPlans
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
        loadAllocationPlanContent={(fileId, signal) =>
          handleApplicationSession(
            loadAllocationPlanContent(
              siteId,
              planId,
              apiUrl,
              fetch,
              fileId,
              signal,
            ),
          )
        }
        planSignsApi={createPlanSignsApi(siteId, planId, apiUrl)}
        loadAllocationPlans={() =>
          handleApplicationSession(loadAllocationPlans(siteId, apiUrl))
        }
        loadDashboard={loadAuthenticatedViewer}
        loadSite={() =>
          handleApplicationSession(loadSiteActivity(siteId, apiUrl))
        }
        loadSites={() => handleApplicationSession(loadSites(apiUrl))}
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
        previewPlanId={planId}
      />
    );
  }
  if (siteAllocationsMatch) {
    const siteId = siteAllocationsMatch[1] ?? '';
    const validSiteId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        siteId,
      );
    const rejectInvalidSitePath = () =>
      Promise.reject(new Error('Invalid Site route'));
    return (
      <SiteAllocationPlans
        {...(dashboardCache ? { preloadedDashboard: dashboardCache } : {})}
        loadDashboard={loadAuthenticatedViewer}
        loadSite={() =>
          validSiteId
            ? handleApplicationSession(loadSiteActivity(siteId, apiUrl))
            : rejectInvalidSitePath()
        }
        loadSites={() =>
          validSiteId
            ? handleApplicationSession(loadSites(apiUrl))
            : rejectInvalidSitePath()
        }
        loadAllocationPlans={() =>
          validSiteId
            ? handleApplicationSession(loadAllocationPlans(siteId, apiUrl))
            : rejectInvalidSitePath()
        }
        createAllocationPlanUploadBatch={(input) =>
          handleApplicationSession(
            createAllocationPlanDraft(siteId, input, apiUrl),
          )
        }
        uploadAllocationPlan={(url, file, headers, options) =>
          uploadAllocationPlan(url, file, headers, fetch, options)
        }
        commitAllocationPlanDraft={(input) =>
          handleApplicationSession(
            commitAllocationPlanDraft(siteId, input, apiUrl),
          ).then(() => undefined)
        }
        finalizeAllocationPlanUpload={(uploadId) =>
          handleApplicationSession(
            verifyAllocationPlanDraft(siteId, uploadId, apiUrl),
          ).then(() => undefined)
        }
        logout={logoutAuthenticatedViewer}
        navigate={navigate}
      />
    );
  }
  if (currentPath === '/login') {
    if (!loginReady) return null;
    return (
      <Login
        login={(input) => loginWithPassword(input, apiUrl)}
        onLoggedIn={(destination, email) => {
          if (destination === '/onboarding/verify-email') {
            window.sessionStorage.setItem(verificationEmailKey, email);
            setVerificationEmail(email);
          } else {
            window.sessionStorage.removeItem(verificationEmailKey);
          }
          navigate(destination);
        }}
      />
    );
  }
  if (currentPath === '/forgot-password') {
    return (
      <ForgotPassword
        requestRecovery={(input) => requestPasswordRecovery(input, apiUrl)}
        onRequested={(email) => {
          window.sessionStorage.setItem(passwordRecoveryEmailKey, email);
          setPasswordRecoveryEmail(email);
          navigate('/reset-password');
        }}
      />
    );
  }
  if (currentPath === '/reset-password') {
    return (
      <ResetPassword
        email={passwordRecoveryEmail}
        requestRecovery={(input) => requestPasswordRecovery(input, apiUrl)}
        resetPassword={(input) => resetPassword(input, apiUrl)}
        onReset={() => {
          window.sessionStorage.removeItem(passwordRecoveryEmailKey);
          window.history.pushState({}, '', '/login?password_reset=success');
          setCurrentPath('/login');
        }}
        onBackToLogin={() => {
          window.sessionStorage.removeItem(passwordRecoveryEmailKey);
          setPasswordRecoveryEmail('');
          navigate('/login');
        }}
      />
    );
  }
  if (currentPath === '/onboarding') {
    return (
      <OnboardingStart
        createAccount={(input) => createOnboardingAccount(input, apiUrl)}
        onCreated={(email, nextStep) => {
          if (nextStep === 'login') {
            window.sessionStorage.removeItem(verificationEmailKey);
            setVerificationEmail('');
            navigate('/login');
            return;
          }
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
        loadProfile={() =>
          loadPersonalProfile(apiUrl).catch(handleSessionExpiry)
        }
        submitProfile={(input) =>
          submitPersonalProfile(input, apiUrl).catch(handleSessionExpiry)
        }
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
        onBack={() => {
          navigate('/onboarding/about-you');
        }}
        onCompleted={(result) => {
          if (result.nextStep === 'contact-sales')
            openExternal(result.destination);
          else navigate(`/onboarding/${result.nextStep}`);
        }}
      />
    );
  }
  if (currentPath === '/onboarding/organization-profile') {
    return (
      <OrganizationProfile
        loadProfile={() => loadOrganizationProfile(apiUrl)}
        submitProfile={(input) => submitOrganizationProfile(input, apiUrl)}
        onCompleted={() => {
          navigate('/onboarding/discovery');
        }}
      />
    );
  }
  if (currentPath === '/onboarding/discovery') {
    return (
      <Discovery
        loadDiscovery={() => loadDiscovery(apiUrl).catch(handleSessionExpiry)}
        completeDiscovery={(input) =>
          completeDiscovery(input, apiUrl).catch(handleSessionExpiry)
        }
        onBack={() => {
          navigate('/onboarding/organization-profile');
        }}
        onCompleted={(result) => {
          openExternal(result.destination);
        }}
      />
    );
  }
  return <Home />;
}
