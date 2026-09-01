import { describe, expect, it } from 'vitest';
import {
  hasOrganizationCapability,
  organizationCapabilities,
  organizationRoleCapabilities,
} from './permissions.js';

describe('organization role capabilities [sites-add-new REQ-010, REQ-011]', () => {
  it('keeps Owner highest and the approved Administrator, Editor, Viewer boundaries explicit', () => {
    expect(organizationRoleCapabilities.owner).toEqual(
      organizationCapabilities,
    );
    expect(hasOrganizationCapability('owner', 'CREATE_SITE')).toBe(true);
    expect(hasOrganizationCapability('administrator', 'CREATE_SITE')).toBe(
      true,
    );
    expect(hasOrganizationCapability('admin', 'CREATE_SITE')).toBe(true);
    expect(hasOrganizationCapability('administrator', 'MANAGE_ACCOUNT')).toBe(
      false,
    );
    expect(hasOrganizationCapability('editor', 'MANAGE_SIGNS')).toBe(true);
    expect(hasOrganizationCapability('editor', 'SHARE_SITE')).toBe(true);
    expect(hasOrganizationCapability('editor', 'CREATE_SITE')).toBe(false);
    expect(hasOrganizationCapability('editor', 'MANAGE_USERS')).toBe(false);
    expect(hasOrganizationCapability('viewer', 'VIEW_SITE')).toBe(true);
    expect(hasOrganizationCapability('viewer', 'COMMENT')).toBe(true);
    expect(hasOrganizationCapability('viewer', 'MANAGE_SIGNS')).toBe(false);
    expect(hasOrganizationCapability('unknown', 'VIEW_SITE')).toBe(false);
  });
});
