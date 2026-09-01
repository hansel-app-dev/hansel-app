/** @spec sites-add-new REQ-015 */
interface ResendClient {
  emails: {
    send(
      input: {
        from: string;
        to: string[];
        subject: string;
        text: string;
        html: string;
      },
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: unknown }>;
  };
}

export interface SiteInvitationEmailInput {
  invitationId: string;
  recipient: string;
  organizationName: string;
  siteName: string;
  token: string;
}

export class SiteInvitationSendError extends Error {}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function createSiteInvitationContent(
  input: SiteInvitationEmailInput,
  applicationOrigin: string,
) {
  const invitationUrl = new URL('/invitations/site', applicationOrigin);
  invitationUrl.searchParams.set('token', input.token);
  const safeOrganization = escapeHtml(input.organizationName);
  const safeSite = escapeHtml(input.siteName);
  const safeUrl = escapeHtml(invitationUrl.toString());
  return {
    subject: `${input.organizationName} invited you to ${input.siteName}`,
    text: `${input.organizationName} invited you to view and comment on ${input.siteName} in Hansel.\n\nAccept invitation: ${invitationUrl.toString()}\n\nThis invitation expires in 7 days.`,
    html: `<!doctype html><html lang="en"><body style="margin:0;padding:32px;background:#F7F5EB;color:#292524;font-family:Figtree,Arial,sans-serif"><main style="max-width:560px;margin:auto;background:#fff;padding:32px"><p style="font-size:24px;font-weight:600">Hansel</p><h1 style="font-size:24px">You've been invited</h1><p>${safeOrganization} invited you to view and comment on <strong>${safeSite}</strong>.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#485463;color:#fff;text-decoration:none;border-radius:4px">Accept invitation</a></p><p style="color:#57534e">This invitation expires in 7 days.</p></main></body></html>`,
  };
}

export function createResendSiteInvitationSender(
  client: ResendClient,
  fromEmail: string,
  applicationOrigin: string,
) {
  return async (input: SiteInvitationEmailInput): Promise<string> => {
    try {
      const result = await client.emails.send(
        {
          from: fromEmail,
          to: [input.recipient],
          ...createSiteInvitationContent(input, applicationOrigin),
        },
        { idempotencyKey: `site-invitation/${input.invitationId}` },
      );
      if (
        result.error ||
        !result.data ||
        !/^[A-Za-z0-9_-]{1,256}$/.test(result.data.id)
      )
        throw new SiteInvitationSendError();
      return result.data.id;
    } catch (error) {
      if (error instanceof SiteInvitationSendError) throw error;
      throw new SiteInvitationSendError();
    }
  };
}

export function createConsoleSiteInvitationSender(
  recordEvent: (name: string, details: { invitationId: string }) => void,
) {
  return (input: SiteInvitationEmailInput): Promise<string> => {
    recordEvent('site_invitation_console_delivery', {
      invitationId: input.invitationId,
    });
    return Promise.resolve(`console-${input.invitationId}`);
  };
}
