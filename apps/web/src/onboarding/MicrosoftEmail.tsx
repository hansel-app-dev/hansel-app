/** @spec microsoft-local-auth REQ-005..REQ-008 */
import { useEffect, useState } from 'react';
import { Button, TextField } from '../design-system/index.js';
import { maskEmail } from './VerifyEmail.js';

interface State {
  email: string;
  sent: boolean;
  resendAfter: number;
}
export interface MicrosoftEmailProps {
  load?: () => Promise<State | null>;
  send?: (email: string) => Promise<void>;
  verify?: (code: string) => Promise<void>;
}
async function loadState(): Promise<State | null> {
  const response = await fetch('/api/auth/microsoft/signup', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error('Signup is temporarily unavailable. Please try again.');
  return response.json() as Promise<State>;
}
async function submit(
  action: 'send' | 'verify',
  body: { email: string } | { code: string },
) {
  const response = await fetch(`/api/auth/microsoft/signup/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('Your signup has expired. Start again with Microsoft.');
    if (response.status === 429)
      throw new Error('Please wait before requesting another code.');
    if (action === 'send')
      throw new Error('We could not send your code. Please try again.');
    throw new Error(
      "We couldn't finish signup. Retry or request a new code. If you already have an account, use your original sign-in method; linking Microsoft isn't supported yet.",
    );
  }
}
const sendCode = (email: string) => submit('send', { email });
const verifyCode = async (code: string) => {
  await submit('verify', { code });
  window.location.assign('/onboarding/about-you');
};

export function MicrosoftEmail({
  load = loadState,
  send = sendCode,
  verify = verifyCode,
}: MicrosoftEmailProps) {
  const [state, setState] = useState<State | null | undefined>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let active = true;
    void load()
      .then((value) => {
        if (active) {
          setState(value);
          setEmail(value?.email ?? '');
          setSeconds(value?.resendAfter ?? 0);
        }
      })
      .catch(() => {
        if (active)
          setError('Signup is temporarily unavailable. Please try again.');
      });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => {
      setSeconds((value) => value - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [seconds]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-content sm:px-12 sm:py-10">
      <a href="/" aria-label="Hansel home">
        <img
          src="/assets/hansel-logo-beta.svg"
          alt="Hansel"
          width="114"
          height="24"
        />
      </a>
      <section className="mx-auto mt-20 flex w-full max-w-md flex-col gap-6">
        <h1 className="text-3xl font-semibold">Confirm your email</h1>
        <p>
          Confirm your email to finish signing up with Microsoft. You only need
          to do this once.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {state === undefined && !error && <p role="status">Loading…</p>}
        {state === null && (
          <p role="status">
            Your signup has expired. Start again with Microsoft.
          </p>
        )}
        {state && (
          <>
            <form
              className="flex flex-col gap-4"
              method="post"
              action="/auth/microsoft/signup"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await send(email);
                  setState({ email, sent: true, resendAfter: 60 });
                  setCode('');
                  setSeconds(60);
                });
              }}
            >
              <input type="hidden" name="action" value="send" />
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
              <Button type="submit" disabled={busy || seconds > 0}>
                {seconds > 0
                  ? `Send again in ${String(seconds)}s`
                  : state.sent
                    ? 'Send a new code'
                    : 'Send verification code'}
              </Button>
            </form>
            {state.sent && (
              <form
                className="flex flex-col gap-4"
                method="post"
                action="/auth/microsoft/signup"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() => verify(code));
                }}
              >
                <p role="status">
                  Enter the code sent to {maskEmail(state.email)}. It expires in
                  15 minutes.
                </p>
                <input type="hidden" name="action" value="verify" />
                <TextField
                  label="Verification code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  disabled={busy}
                  onChange={(event) => {
                    setCode(event.target.value);
                  }}
                />
                <Button type="submit" disabled={busy || code.length !== 6}>
                  Verify email
                </Button>
              </form>
            )}
          </>
        )}
        <div className="flex gap-4">
          <a href="/onboarding">Create an account</a>
          <a href="/login">Log in</a>
        </div>
      </section>
    </main>
  );
}
