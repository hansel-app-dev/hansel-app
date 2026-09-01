/** @spec sites-add-new REQ-010, REQ-011 */
export const organizationCapabilities = [
  'MANAGE_ACCOUNT',
  'MANAGE_USERS',
  'CREATE_SITE',
  'MANAGE_SITE',
  'MANAGE_SIGNS',
  'SHARE_SITE',
  'VIEW_SITE',
  'COMMENT',
] as const;

export type OrganizationCapability = (typeof organizationCapabilities)[number];

export const organizationRoleCapabilities = {
  owner: organizationCapabilities,
  administrator: [
    'MANAGE_USERS',
    'CREATE_SITE',
    'MANAGE_SITE',
    'MANAGE_SIGNS',
    'SHARE_SITE',
    'VIEW_SITE',
    'COMMENT',
  ],
  admin: [
    'MANAGE_USERS',
    'CREATE_SITE',
    'MANAGE_SITE',
    'MANAGE_SIGNS',
    'SHARE_SITE',
    'VIEW_SITE',
    'COMMENT',
  ],
  editor: ['MANAGE_SIGNS', 'SHARE_SITE', 'VIEW_SITE', 'COMMENT'],
  viewer: ['VIEW_SITE', 'COMMENT'],
} as const satisfies Record<string, readonly OrganizationCapability[]>;

export function hasOrganizationCapability(
  roleId: string,
  capability: OrganizationCapability,
): boolean {
  const capabilities = organizationRoleCapabilities[
    roleId as keyof typeof organizationRoleCapabilities
  ] as readonly OrganizationCapability[] | undefined;
  return capabilities?.includes(capability) ?? false;
}
