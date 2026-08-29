/** @spec dashboard-home REQ-001..REQ-017 @figma 40:502 */
import { useEffect, useState } from 'react';
import type { DashboardResponse } from '@hansel/contracts';
import { Button } from '../design-system/index.js';

const navigation = [
  { label: 'Dashboard', icon: 'home', current: true },
  { label: 'Sites', icon: 'domain_add', current: false },
] as const;
const libraries = [
  { label: 'Styleguide', icon: 'text_fields' },
  { label: 'Documents', icon: 'folder' },
] as const;

function Symbol({
  children,
  weight = 200,
}: {
  children: string;
  weight?: 100 | 200;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-${String(weight)} inline-flex size-6 shrink-0 items-center justify-center text-[24px]`}
    >
      {children}
    </span>
  );
}

export function Dashboard({
  loadDashboard,
}: {
  loadDashboard: () => Promise<DashboardResponse>;
}) {
  const [viewer, setViewer] = useState<DashboardResponse['viewer'] | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setViewer(null);
    void loadDashboard()
      .then((response) => {
        if (active) setViewer(response.viewer);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, loadDashboard]);

  return (
    <main className="flex min-h-screen bg-surface text-content max-md:flex-col">
      <h1 className="sr-only">Dashboard</h1>
      <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e5e5e5] bg-surface px-8 py-7 max-md:w-full max-md:border-b max-md:border-r-0 max-md:px-5 max-md:py-5">
        <img
          className="h-[27px] w-auto self-start"
          src="/assets/hansel-logo-beta.svg"
          alt="Hansel Beta"
        />
        <nav
          className="mt-[66px] flex flex-1 flex-col max-md:mt-7 max-md:grid max-md:grid-cols-2 max-md:gap-2"
          aria-label="Application"
        >
          <div className="grid gap-3">
            {navigation.map((item) => (
              <span
                key={item.label}
                aria-current={item.current ? 'page' : undefined}
                aria-disabled={item.current ? undefined : true}
                className={`flex min-h-12 items-center gap-3 rounded px-4 text-[16px] ${item.current ? 'bg-[#f3f3f3] font-semibold' : 'text-[#4d4d4d]'}`}
              >
                <Symbol>{item.icon}</Symbol>
                {item.label}
              </span>
            ))}
          </div>
          <div className="mt-11 grid gap-3 max-md:mt-0">
            <p className="px-4 text-[13px] text-[#737373]">Libraries</p>
            {libraries.map((item) => (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex min-h-12 items-center gap-3 rounded px-4 text-[16px] text-[#4d4d4d]"
              >
                <Symbol>{item.icon}</Symbol>
                {item.label}
              </span>
            ))}
          </div>
        </nav>
        <section
          className="mt-8 flex min-h-14 items-center gap-4 max-md:mt-6"
          aria-label="Signed-in account"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e9e9e9] text-sm text-[#444]">
            {viewer?.initials ?? '—'}
          </span>
          <div className="min-w-0">
            {viewer ? (
              <>
                <p className="truncate text-[16px]">{viewer.displayName}</p>
                <p className="mt-1 truncate text-[14px] text-[#737373]">
                  {viewer.roleLabel}
                </p>
              </>
            ) : loadError ? null : (
              <p role="status" className="text-sm text-[#737373]">
                Loading account…
              </p>
            )}
          </div>
        </section>
      </aside>
      <section className="min-w-0 flex-1" aria-labelledby="dashboard-content">
        <h2 id="dashboard-content" className="sr-only">
          Dashboard widgets
        </h2>
        <header className="flex h-[68px] items-center justify-end gap-5 border-b border-[#e5e5e5] px-8 max-md:h-14 max-md:px-5">
          <span className="relative inline-flex" aria-hidden="true">
            <Symbol weight={100}>notifications_none</Symbol>
            <span className="absolute right-[2px] top-0 size-[6px] rounded-full bg-[#f59e0b]" />
          </span>
          <Symbol weight={100}>tune</Symbol>
        </header>
        {loadError ? (
          <div className="mx-10 mt-8 flex items-center gap-4 max-md:mx-5 max-md:flex-col max-md:items-start">
            <p role="alert" className="text-danger">
              We couldn't load your dashboard. Please try again.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-4 gap-6 p-10 max-xl:grid-cols-2 max-md:grid-cols-1 max-md:p-5">
          {Array.from({ length: 4 }, (_, index) => (
            <article
              key={index}
              className="min-h-[244px] overflow-hidden rounded-lg border border-[#dddddd] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
            >
              <h2 className="border-b border-[#e5e5e5] px-6 py-5 text-[16px] font-normal">
                Widget title
              </h2>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
