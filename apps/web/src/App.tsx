import { useEffect, useState } from 'react';
import { getHealth } from './api.js';
import './styles.css';

type HealthState = 'checking' | 'healthy' | 'unavailable';

const healthStyles: Record<HealthState, string> = {
  checking: 'bg-slate-400 motion-safe:animate-health-pulse',
  healthy: 'bg-emerald-400 shadow-[0_0_0_4px_#34d39922]',
  unavailable: 'bg-rose-400 shadow-[0_0_0_4px_#fb718522]',
};

export function App({ apiUrl = '' }: { apiUrl?: string }) {
  const [health, setHealth] = useState<HealthState>('checking');

  useEffect(() => {
    let active = true;
    void getHealth(apiUrl)
      .then(() => {
        if (active) setHealth('healthy');
      })
      .catch(() => {
        if (active) setHealth('unavailable');
      });
    return () => {
      active = false;
    };
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_70%_20%,#17345a_0,#07111f_45%)]">
      <header className="flex min-h-18 items-center border-b border-white/10 px-[6vw]">
        <a
          className="text-xl font-[750] tracking-[-0.04em] text-inherit no-underline"
          href="/"
          aria-label="Hansel home"
        >
          Hansel
        </a>
      </header>
      <main>
        <section
          className="max-w-190 px-[6vw] py-[clamp(5rem,14vh,10rem)]"
          aria-labelledby="hero-heading"
        >
          <p className="text-[0.8rem] font-bold tracking-[0.14em] text-sky-300 uppercase">
            Spec-driven SaaS
          </p>
          <h1
            className="my-4 max-w-175 text-[clamp(3rem,8vw,6.5rem)] leading-[0.94] font-bold tracking-[-0.065em]"
            id="hero-heading"
          >
            Build with a trail you can trust.
          </h1>
          <p className="max-w-150 text-[clamp(1.1rem,2vw,1.4rem)] leading-[1.6] text-slate-300">
            Every Hansel capability begins as a reviewed promise and ships with
            proof.
          </p>
          <div
            className="mt-8 inline-flex items-center gap-[0.65rem] rounded-full border border-white/10 bg-white/5 px-[0.9rem] py-[0.65rem] text-slate-200"
            role="status"
            aria-live="polite"
          >
            <span
              className={`size-[0.6rem] rounded-full ${healthStyles[health]}`}
              aria-hidden="true"
            />
            API {health}
          </div>
        </section>
      </main>
    </div>
  );
}
