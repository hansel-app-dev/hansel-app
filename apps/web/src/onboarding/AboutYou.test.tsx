import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutYou } from './AboutYou.js';
afterEach(cleanup);

describe('AboutYou [REQ-086, REQ-087]', () => {
  it('matches the specified Figma copy and approved catalogs', () => {
    render(<AboutYou submitProfile={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Tell us about you' }),
    ).toHaveFocus();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Facility manager' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Development / Advancement Office' }),
    ).toBeInTheDocument();
    expect(screen.getByText('All fields are required.')).toBeVisible();
    expect(
      screen.getByRole('form', { name: 'Tell us about you form' }),
    ).toHaveAttribute('action', '/api/onboarding/personal-profile');
  });

  it('validates required fields and conditional Other details', async () => {
    render(<AboutYou submitProfile={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Enter your first name.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Job title'), {
      target: { value: 'other' },
    });
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'other' },
    });
    expect(screen.getByLabelText('Other job title')).toBeInTheDocument();
    expect(screen.getByLabelText('Other department')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Enter your job title.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Enter your department.'),
    ).toBeInTheDocument();
  });

  it('submits normalized values and completes the step', async () => {
    const submitProfile = vi.fn().mockResolvedValue(undefined);
    const onCompleted = vi.fn();
    render(
      <AboutYou submitProfile={submitProfile} onCompleted={onCompleted} />,
    );
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: ' Nabin ' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: ' Singh ' },
    });
    fireEvent.change(screen.getByLabelText('Job title'), {
      target: { value: 'manager' },
    });
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'marketing_communications' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(submitProfile).toHaveBeenCalledWith({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      });
    });
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it('shows a stable error when saving fails', async () => {
    render(
      <AboutYou
        submitProfile={vi.fn().mockRejectedValue(new Error('secret'))}
      />,
    );
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(
      'We could not save your details. Please try again.',
    );
    expect(error).toHaveFocus();
    expect(screen.getByLabelText('First name')).toHaveValue('Nabin');
    expect(screen.getByLabelText('Last name')).toHaveValue('Singh');
  });

  it('normalizes Unicode and counts characters instead of UTF-16 units', async () => {
    const submitProfile = vi.fn().mockResolvedValue(undefined);
    render(<AboutYou submitProfile={submitProfile} />);
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: ` Cafe\u0301 ${'😀'.repeat(95)}` },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Singh' },
    });
    fireEvent.change(screen.getByLabelText('Job title'), {
      target: { value: 'manager' },
    });
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'marketing_communications' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(submitProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: `Café ${'😀'.repeat(95)}` }),
      );
    });
  });
});
