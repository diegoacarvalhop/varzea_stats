import { describe, expect, it } from 'vitest';
import {
  EVENT_RECORDER_ROLES,
  hasAnyRole,
  hasRole,
  isAdminGeral,
  isAnyAdmin,
  MATCH_MANAGER_ROLES,
} from '@/lib/roles';
import type { Role } from '@/services/authService';

describe('roles', () => {
  const roles: Role[] = ['SCOUT', 'PLAYER'];

  it('hasRole', () => {
    expect(hasRole(roles, 'SCOUT')).toBe(true);
    expect(hasRole(roles, 'MEDIA')).toBe(false);
    expect(hasRole(null, 'SCOUT')).toBe(false);
  });

  it('hasAnyRole', () => {
    expect(hasAnyRole(roles, MATCH_MANAGER_ROLES)).toBe(true);
    expect(hasAnyRole(roles, ['MEDIA'])).toBe(false);
    expect(hasAnyRole([], MATCH_MANAGER_ROLES)).toBe(false);
  });

  it('isAdminGeral e isAnyAdmin', () => {
    expect(isAdminGeral(['ADMIN_GERAL'])).toBe(true);
    expect(isAdminGeral(['ADMIN'])).toBe(false);
    expect(isAnyAdmin(['ADMIN'])).toBe(true);
    expect(isAnyAdmin(['PLAYER'])).toBe(false);
  });

  it('EVENT_RECORDER_ROLES inclui SCOUT', () => {
    expect(EVENT_RECORDER_ROLES).toContain('SCOUT');
  });
});
