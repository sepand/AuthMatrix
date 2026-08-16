import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  buildOktaSessionToken,
  buildEntraSessionToken,
  IdTokenClaims,
  SessionUser
} from '../../apps/astro-frontend/src/lib/oidc.js';

const SESSION_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

describe('Tier 1 Unit: Multi-IdP Claim Normalization (Okta & Entra ID)', () => {
  const baseClaims: IdTokenClaims = {
    sub: 'usr_100',
    email: 'user@example.com',
    name: 'Alice Example',
    iss: 'https://dev-12345.okta.com/oauth2/default',
    aud: '0oa123456789',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  describe('Feature 13: Okta Group Claim Normalization', () => {
    it('should map "Admin" group to internal "Admin" role with full permissions', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Admin', 'Everyone'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Admin']);
      assert.equal(decoded.idp, 'okta');
      assert.equal(decoded.sub, 'usr_100');
      assert.ok(decoded.permissions.includes('write:users'));
      assert.ok(decoded.permissions.includes('delete:audit'));
      assert.equal(decoded.permissions.length, 9);
    });

    it('should map "SecurityEngineers" group to internal "Admin" role', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['SecurityEngineers', 'AllEmployees'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Admin']);
      assert.ok(decoded.permissions.includes('write:settings'));
    });

    it('should map "Managers" group to internal "Manager" role', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Managers'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Manager']);
      assert.deepEqual(decoded.permissions, ['read:users', 'read:reports', 'write:reports']);
    });

    it('should map "Developers" group to internal "Developer" role', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Developers'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
      assert.deepEqual(decoded.permissions, ['read:users', 'read:reports', 'execute:jobs']);
    });

    it('should map "Auditors" group to internal "Auditor" role', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Auditors'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Auditor']);
      assert.deepEqual(decoded.permissions, ['read:audit', 'read:reports']);
    });

    it('should deduplicate roles if multiple Okta groups map to the same internal role (Admin + SecurityEngineers)', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Admin', 'SecurityEngineers', 'Everyone'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Admin']);
      assert.equal(decoded.roles.length, 1);
    });

    it('should combine permissions for multiple distinct mapped roles (Managers + Developers)', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Managers', 'Developers'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.ok(decoded.roles.includes('Manager'));
      assert.ok(decoded.roles.includes('Developer'));
      assert.ok(decoded.permissions.includes('read:users'));
      assert.ok(decoded.permissions.includes('write:reports'));
      assert.ok(decoded.permissions.includes('execute:jobs'));
    });

    it('should fallback to default "Developer" role when groups is empty', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: [] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });

    it('should fallback to default "Developer" role when all groups are unmapped', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Everyone', 'Sales', 'Marketing', 'Contractors'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });

    it('should handle undefined groups claim gracefully by defaulting to Developer', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: undefined };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });
  });

  describe('Feature 13: Entra ID App Roles Claim Normalization', () => {
    it('should preserve recognized Entra "Admin" app role', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['Admin'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Admin']);
      assert.equal(decoded.idp, 'entra');
      assert.equal(decoded.permissions.length, 9);
    });

    it('should preserve recognized Entra "Manager" app role', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['Manager'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Manager']);
      assert.deepEqual(decoded.permissions, ['read:users', 'read:reports', 'write:reports']);
    });

    it('should preserve recognized Entra "Developer" app role', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['Developer'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
      assert.deepEqual(decoded.permissions, ['read:users', 'read:reports', 'execute:jobs']);
    });

    it('should preserve recognized Entra "Auditor" app role', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['Auditor'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Auditor']);
      assert.deepEqual(decoded.permissions, ['read:audit', 'read:reports']);
    });

    it('should filter out unrecognized Entra roles and preserve valid ones', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['User.Read', 'CustomAppRole', 'Manager'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Manager']);
    });

    it('should fallback to default "Developer" role when Entra roles array is empty', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: [] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });

    it('should fallback to default "Developer" role when all Entra roles are unrecognized', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: ['AppRole1', 'UnknownGuest'] };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });

    it('should handle undefined Entra roles claim gracefully', () => {
      const claims: IdTokenClaims = { ...baseClaims, roles: undefined };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.deepEqual(decoded.roles, ['Developer']);
    });
  });

  describe('Feature 13: Session Token Structure & Identity Properties', () => {
    it('should generate valid JWT with standard claims (iss, aud, exp)', () => {
      const claims: IdTokenClaims = { ...baseClaims, groups: ['Admin'] };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as any;

      assert.equal(decoded.iss, 'https://authmatrix.local');
      assert.equal(decoded.aud, 'https://api.authmatrix.local');
      assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
    });

    it('should fallback name to email if name is missing in Okta claims', () => {
      const claims: IdTokenClaims = { ...baseClaims, name: undefined, email: 'fallback@okta.local' };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.equal(decoded.name, 'fallback@okta.local');
    });

    it('should fallback name to default placeholder if both name and email are missing', () => {
      const claims: IdTokenClaims = { ...baseClaims, name: undefined, email: undefined };
      const token = buildOktaSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.equal(decoded.name, 'Okta User');
      assert.equal(decoded.email, '');
    });

    it('should fallback name to default placeholder if both name and email are missing in Entra', () => {
      const claims: IdTokenClaims = { ...baseClaims, name: undefined, email: undefined };
      const token = buildEntraSessionToken(claims);
      const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;

      assert.equal(decoded.name, 'Entra User');
    });
  });
});
