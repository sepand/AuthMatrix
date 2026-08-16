import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission, AuthenticatedRequest } from '../../apps/api-server/src/middleware/auth.js';
import type { Response, NextFunction } from 'express';

// Helper to create mock Express req/res/next objects
function createMockContext(user?: AuthenticatedRequest['user']) {
  const req = {
    headers: {},
    user,
  } as unknown as AuthenticatedRequest;

  let statusCode = 200;
  let jsonBody: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  } as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
    wasNextCalled: () => nextCalled,
  };
}

describe('Tier 1 Unit: Zero Trust RBAC & Permission Matrix', () => {
  // ── Role Permission Definitions ──
  const ROLE_PERMISSIONS: Record<string, string[]> = {
    Admin: [
      'read:users', 'write:users', 'delete:users',
      'read:reports', 'write:reports', 'write:settings',
      'read:audit', 'delete:audit', 'execute:jobs'
    ],
    Manager: ['read:users', 'read:reports', 'write:reports'],
    Developer: ['read:users', 'read:reports', 'execute:jobs'],
    Auditor: ['read:audit', 'read:reports'],
  };

  describe('Feature 10: Admin Role Permissiveness & Wildcard Access', () => {
    it('Admin role should pass requirePermission(read:users)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('read:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(write:users)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('write:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(delete:users)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('delete:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(read:reports)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(write:reports)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('write:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(write:settings)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('write:settings')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(read:audit)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('read:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(delete:audit)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('delete:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass requirePermission(execute:jobs)', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: ROLE_PERMISSIONS.Admin });
      requirePermission('execute:jobs')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Admin role should pass even without explicit permissions array due to Admin role bypass', () => {
      const ctx = createMockContext({ sub: 'admin_1', roles: ['Admin'], permissions: [] });
      requirePermission('custom:action')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });
  });

  describe('Feature 10: Manager Role Isolation & Boundaries', () => {
    it('Manager should pass read:users', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('read:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Manager should pass read:reports', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Manager should pass write:reports', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('write:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Manager should be denied write:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('write:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
      assert.equal(ctx.getJsonBody().error, 'Forbidden');
      assert.match(ctx.getJsonBody().message, /write:users/);
    });

    it('Manager should be denied delete:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('delete:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Manager should be denied write:settings with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('write:settings')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Manager should be denied read:audit with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('read:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Manager should be denied delete:audit with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('delete:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Manager should be denied execute:jobs with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'mgr_1', roles: ['Manager'], permissions: ROLE_PERMISSIONS.Manager });
      requirePermission('execute:jobs')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });
  });

  describe('Feature 10: Developer Role Isolation & Boundaries', () => {
    it('Developer should pass read:users', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('read:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Developer should pass read:reports', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Developer should pass execute:jobs', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('execute:jobs')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Developer should be denied write:reports with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('write:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Developer should be denied write:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('write:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Developer should be denied delete:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('delete:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Developer should be denied write:settings with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('write:settings')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Developer should be denied read:audit with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('read:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Developer should be denied delete:audit with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'dev_1', roles: ['Developer'], permissions: ROLE_PERMISSIONS.Developer });
      requirePermission('delete:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });
  });

  describe('Feature 10: Auditor Role Isolation & Boundaries', () => {
    it('Auditor should pass read:audit', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('read:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Auditor should pass read:reports', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Auditor should be denied read:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('read:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied write:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('write:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied delete:users with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('delete:users')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied write:reports with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('write:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied write:settings with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('write:settings')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied delete:audit with 403 Forbidden (preventing tampering)', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('delete:audit')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Auditor should be denied execute:jobs with 403 Forbidden', () => {
      const ctx = createMockContext({ sub: 'aud_1', roles: ['Auditor'], permissions: ROLE_PERMISSIONS.Auditor });
      requirePermission('execute:jobs')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });
  });

  describe('Feature 10: Zero Trust Edge Cases & Unauthenticated State', () => {
    it('Should return 401 Unauthorized if req.user is undefined', () => {
      const ctx = createMockContext(undefined);
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.equal(ctx.getJsonBody().error, 'Unauthorized');
    });

    it('Should return 403 if user has empty roles and empty permissions', () => {
      const ctx = createMockContext({ sub: 'anon_1', roles: [], permissions: [] });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Should return 403 if user roles is undefined on object', () => {
      const ctx = createMockContext({ sub: 'anon_1' });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });

    it('Should grant access when user has custom permission matching requirement', () => {
      const ctx = createMockContext({ sub: 'custom_1', roles: ['CustomRole'], permissions: ['custom:action'] });
      requirePermission('custom:action')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Should grant access if user has multiple roles including a permitted one', () => {
      const ctx = createMockContext({
        sub: 'multi_1',
        roles: ['Developer', 'Manager'],
        permissions: ['read:users', 'read:reports', 'write:reports', 'execute:jobs']
      });
      requirePermission('write:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), true);
    });

    it('Should enforce case-sensitivity on permissions', () => {
      const ctx = createMockContext({ sub: 'case_1', roles: ['Developer'], permissions: ['READ:REPORTS'] });
      requirePermission('read:reports')(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 403);
    });
  });
});
