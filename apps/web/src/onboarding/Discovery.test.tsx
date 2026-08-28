import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoveryManagementOptions } from '@hansel/contracts';
import { Discovery } from './Discovery.js';

afterEach(cleanup);

const page = {
  submissionKey: 'x'.repeat(43),
  methods: [...discoveryManagementOptions],
};

describe('Discovery [onboarding-discovery REQ-001..REQ-016]', () => {
  it('loads the exact Figma wording, methods, and actions', async () => {
    const onBack = vi.fn();
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={vi.fn()}
        onBack={onBack}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Could you tell us more?' }),
    ).toBeVisible();
    const select = await screen.findByLabelText(
      'How do you manage your signage currently?',
    );
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'PDF' })).toHaveValue('pdf');
    expect(screen.getByRole('option', { name: 'Spreadsheet' })).toHaveValue(
      'spreadsheet',
    );
    expect(screen.getByRole('option', { name: 'Other' })).toHaveValue('other');
    expect(
      screen.getByLabelText('Biggest challenges your team faces'),
    ).toHaveAttribute('placeholder', 'Challenges');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('focuses and describes required and overlong values', async () => {
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={vi.fn()}
      />,
    );
    const select = await screen.findByLabelText(
      'How do you manage your signage currently?',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Select how you currently manage signage.'),
    ).toBeVisible();
    expect(select).toHaveFocus();
    fireEvent.change(select, { target: { value: 'pdf' } });
    const challenges = screen.getByLabelText(
      'Biggest challenges your team faces',
    );
    fireEvent.change(challenges, { target: { value: 'x'.repeat(1_001) } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Use 1,000 characters or fewer.'),
    ).toBeVisible();
    expect(challenges).toHaveFocus();
  });

  it('reveals, validates, submits, and clears Other tools', async () => {
    const completeDiscovery = vi.fn().mockResolvedValue({
      nextStep: 'dashboard',
      destination: '/dashboard',
    });
    const onCompleted = vi.fn();
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={completeDiscovery}
        onCompleted={onCompleted}
      />,
    );
    const select = await screen.findByLabelText(
      'How do you manage your signage currently?',
    );
    fireEvent.change(select, { target: { value: 'other' } });
    const other = screen.getByLabelText('Other tools');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(other).toHaveFocus();
    fireEvent.change(other, { target: { value: 'Signage platform' } });
    fireEvent.change(
      screen.getByLabelText('Biggest challenges your team faces'),
      {
        target: { value: 'Version control' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledOnce();
    });
    expect(completeDiscovery).toHaveBeenCalledWith({
      action: 'submit',
      currentManagement: 'other',
      currentManagementOther: 'Signage platform',
      challenges: 'Version control',
      submissionKey: page.submissionKey,
    });

    fireEvent.change(select, { target: { value: 'pdf' } });
    expect(screen.queryByLabelText('Other tools')).not.toBeInTheDocument();
  });

  it('submits a method without optional values', async () => {
    const completeDiscovery = vi.fn().mockResolvedValue({
      nextStep: 'dashboard',
      destination: '/dashboard',
    });
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={completeDiscovery}
      />,
    );
    fireEvent.change(
      await screen.findByLabelText('How do you manage your signage currently?'),
      { target: { value: 'spreadsheet' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(completeDiscovery).toHaveBeenCalledWith({
        action: 'submit',
        currentManagement: 'spreadsheet',
        submissionKey: page.submissionKey,
      });
    });
  });

  it('skips without submitting unsaved answers', async () => {
    const completeDiscovery = vi.fn().mockResolvedValue({
      nextStep: 'dashboard',
      destination: '/dashboard',
    });
    const onCompleted = vi.fn();
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={completeDiscovery}
        onCompleted={onCompleted}
      />,
    );
    await screen.findByLabelText('How do you manage your signage currently?');
    fireEvent.change(
      screen.getByLabelText('Biggest challenges your team faces'),
      {
        target: { value: 'Unsaved private answer' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledOnce();
    });
    expect(completeDiscovery).toHaveBeenCalledWith({
      action: 'skip',
      submissionKey: page.submissionKey,
    });
  });

  it('announces load, submit, and skip failures', async () => {
    const loadFailure = render(
      <Discovery
        loadDiscovery={() => Promise.reject(new Error('no'))}
        completeDiscovery={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not load',
    );
    loadFailure.unmount();

    const completeDiscovery = vi.fn().mockRejectedValue(new Error('no'));
    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={completeDiscovery}
      />,
    );
    fireEvent.change(
      await screen.findByLabelText('How do you manage your signage currently?'),
      { target: { value: 'pdf' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not save',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not skip',
    );
  });

  it('disables both completion actions while submitting or skipping', async () => {
    const pending = new Promise<never>(() => undefined);
    const view = render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={() => pending}
      />,
    );
    fireEvent.change(
      await screen.findByLabelText('How do you manage your signage currently?'),
      { target: { value: 'pdf' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeDisabled();
    view.unmount();

    render(
      <Discovery
        loadDiscovery={() => Promise.resolve(page)}
        completeDiscovery={() => pending}
      />,
    );
    await screen.findByLabelText('How do you manage your signage currently?');
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeDisabled();
  });
});
