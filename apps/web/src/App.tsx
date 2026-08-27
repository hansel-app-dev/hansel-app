import { useEffect, useState } from 'react';
import { getHealth } from './api.js';
import './styles.css';

type HealthState = 'checking' | 'healthy' | 'unavailable';

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
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Hansel home">
          Hansel
        </a>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <p className="eyebrow">Spec-driven SaaS</p>
          <h1 id="hero-heading">Build with a trail you can trust.</h1>
          <p className="lede">
            Every Hansel capability begins as a reviewed promise and ships with
            proof.
          </p>
          <div className="status" role="status" aria-live="polite">
            <span className={`dot dot--${health}`} aria-hidden="true" />
            API {health}
          </div>
        </section>
      </main>
    </div>
  );
}
