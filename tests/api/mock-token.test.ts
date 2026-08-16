import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { ensureServer, BASE_URL, JWT_SECRET } from '../helpers/server-helper.js';

describe('Tier 2 API: Mock Token Minting & JWT Inspection', () => {
  before(async () => {
    await ensureServer();
  });

  describe('Feature 11: POST /api/auth/mock-token', () => {
    it('should generate a valid JWT token for Admin role with 9 permissions', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Admin' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'Admin');
      assert.ok(Array.isArray(data.permissions));
      assert.equal(data.permissions.length, 9);
      assert.ok(data.permissions.includes('write:users'));
      assert.ok(data.permissions.includes('delete:audit'));
      assert.ok(data.permissions.includes('execute:jobs'));
      assert.ok(typeof data.token === 'string');

      // Verify JWT cryptographically
      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      assert.equal(decoded.sub, 'usr_admin_123');
      assert.equal(decoded.email, 'admin@authmatrix.local');
      assert.deepEqual(decoded.roles, ['Admin']);
      assert.equal(decoded.iss, 'https://authmatrix.local');
      assert.equal(decoded.aud, 'https://api.authmatrix.local');
      assert.equal(decoded.idp, 'local');
    });

    it('should generate a valid JWT token for Manager role with 3 permissions', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Manager' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'Manager');
      assert.deepEqual(data.permissions, ['read:users', 'read:reports', 'write:reports']);

      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      assert.equal(decoded.sub, 'usr_manager_123');
      assert.deepEqual(decoded.roles, ['Manager']);
    });

    it('should generate a valid JWT token for Developer role with 3 permissions', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Developer' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'Developer');
      assert.deepEqual(data.permissions, ['read:users', 'read:reports', 'execute:jobs']);

      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      assert.equal(decoded.sub, 'usr_developer_123');
      assert.deepEqual(decoded.roles, ['Developer']);
    });

    it('should generate a valid JWT token for Auditor role with 2 permissions', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Auditor' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'Auditor');
      assert.deepEqual(data.permissions, ['read:audit', 'read:reports']);

      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      assert.equal(decoded.sub, 'usr_auditor_123');
      assert.deepEqual(decoded.roles, ['Auditor']);
    });

    it('should default to Developer role when request body is empty', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'Developer');
      assert.deepEqual(data.permissions, ['read:users', 'read:reports', 'execute:jobs']);
    });

    it('should fallback to read:reports permission for unknown role strings', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'GuestRole' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.role, 'GuestRole');
      assert.deepEqual(data.permissions, ['read:reports']);
    });

    it('should set JWT header alg to HS256', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Admin' }),
      });

      const data = await res.json();
      const decodedComplete = jwt.decode(data.token, { complete: true });
      assert.ok(decodedComplete);
      assert.equal(decodedComplete.header.alg, 'HS256');
      assert.equal(decodedComplete.header.typ, 'JWT');
    });

    it('should set expiration to approximately 2 hours in the future', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/mock-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Admin' }),
      });

      const data = await res.json();
      const decoded = jwt.decode(data.token) as any;
      const nowEpoch = Math.floor(Date.now() / 1000);
      const diffSec = decoded.exp - nowEpoch;

      // 2 hours = 7200 seconds, allow tolerance of +/- 60s
      assert.ok(diffSec >= 7140 && diffSec <= 7260, `Exp diff ${diffSec}s should be around 7200s`);
    });
  });
});
