import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  countryOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';
import { OrganizationProfile } from './OrganizationProfile.js';

afterEach(cleanup);

const page = {
  submissionKey: 'x'.repeat(43),
  countries: countryOptions,
  industries: [...industryOptions],
  placesByIndustry: Object.fromEntries(
    Object.entries(placeServiceOptions).map(([key, values]) => [
      key,
      [...values],
    ]),
  ),
  sizes: [...organizationSizeOptions],
};

describe('OrganizationProfile [onboarding-organization-profile REQ-001..REQ-019]', () => {
  it('loads the Figma fields, keeps place/service white, and filters dependent options [REQ-019]', async () => {
    const submitProfile = vi.fn().mockResolvedValue({ nextStep: 'discovery' });
    render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={submitProfile}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Now your organization' }),
    ).toBeVisible();
    expect(await screen.findByLabelText('Organization')).toBeVisible();
    const placeService = screen.getByLabelText('Type of place or service');
    expect(placeService).toBeDisabled();
    expect(placeService).toHaveClass('disabled:!bg-surface');
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    expect(screen.getByRole('option', { name: 'Clinics' })).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Airports' }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(submitProfile).toHaveBeenCalledOnce();
    });
  });

  it('submits valid stable identifiers and completes', async () => {
    const submitProfile = vi.fn().mockResolvedValue({ nextStep: 'discovery' });
    const onCompleted = vi.fn();
    render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={submitProfile}
        onCompleted={onCompleted}
      />,
    );
    await screen.findByLabelText('Organization');
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledWith({ nextStep: 'discovery' });
    });
    expect(submitProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'AU',
        placeService: 'clinics',
        submissionKey: page.submissionKey,
      }),
    );
  });

  it('shows validation and retains valid input', async () => {
    render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={vi.fn()}
      />,
    );
    const organization = await screen.findByLabelText('Organization');
    const country = screen.getByLabelText('Country');
    fireEvent.change(organization, { target: { value: 'Hansel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(organization).toHaveValue('Hansel');
    fireEvent.change(organization, { target: { value: '' } });
    fireEvent.change(country, { target: { value: 'AU' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(organization).toBeInvalid());
    expect(country).toHaveValue('AU');
  });

  it('clears a stale place when industry changes', async () => {
    render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={vi.fn()}
      />,
    );
    await screen.findByLabelText('Industry or sector');
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'education' },
    });
    expect(screen.getByLabelText('Type of place or service')).toHaveValue('');
  });

  it('restores accepted values when returning from discovery [onboarding-discovery REQ-012]', async () => {
    render(
      <OrganizationProfile
        loadProfile={() =>
          Promise.resolve({
            ...page,
            profile: {
              organizationName: 'Hansel',
              country: 'AU',
              industry: 'healthcare',
              placeService: 'clinics',
              organizationSize: 'employees_11_50',
            },
          })
        }
        submitProfile={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Organization')).toHaveValue('Hansel'),
    );
    expect(screen.getByLabelText('Country')).toHaveValue('AU');
    expect(screen.getByLabelText('Industry or sector')).toHaveValue(
      'healthcare',
    );
    expect(screen.getByLabelText('Type of place or service')).toHaveValue(
      'clinics',
    );
    expect(screen.getByLabelText('Size')).toHaveValue('employees_11_50');
  });

  it('announces load and submit failures and disables while submitting', async () => {
    const deferred = new Promise<never>(() => undefined);
    const view = render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={() => deferred}
      />,
    );
    await screen.findByLabelText('Organization');
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    const form = screen.getByRole('button', { name: 'Next' }).closest('form');
    if (!form) throw new Error('Expected organization form');
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    view.unmount();
    render(
      <OrganizationProfile
        loadProfile={() => Promise.reject(new Error('no'))}
        submitProfile={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not load',
    );
  });

  it('announces a recoverable server rejection', async () => {
    render(
      <OrganizationProfile
        loadProfile={() => Promise.resolve(page)}
        submitProfile={() => Promise.reject(new Error('no'))}
      />,
    );
    await screen.findByLabelText('Organization');
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not save',
    );
  });
});
