import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { ensureServer, BASE_URL, createMockToken, JWT_SECRET } from '../helpers/server-helper.js';

describe('Tier 2 API: APIM Gateway Simulator Edge Perimeter', () => {
  before(async () => {
    await ensureServer();
  });

  const validToken = createMockToken('Admin', {
    sub: 'usr_gateway_tester',
    permissions: ['read:users', 'write:reports'],
  });

  describe('Feature 11 / Zero Trust: Edge Gateway Route (/api/gateway/protected-resource)', () => {
    it('should grant access and inject verified headers when valid Bearer token is provided', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: { Authorization: `Bearer ${validToken}` }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('API Gateway Edge perimeter'));
      assert.equal(data.gatewayInjectedHeaders['x-user-id'], 'usr_gateway_tester');
      assert.equal(data.gatewayInjectedHeaders['x-user-roles'], 'Admin');
      assert.equal(data.gatewayInjectedHeaders['x-user-permissions'], 'read:users,write:reports');
      assert.ok(data.note.includes('stripped untrusted headers'));
    });

    it('should strip untrusted client-supplied headers and replace with verified token claims', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'X-User-Id': 'attacker_impersonated_id',
          'X-User-Roles': 'SuperAdmin,Root',
          'X-User-Permissions': 'all:grant',
        }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.gatewayInjectedHeaders['x-user-id'], 'usr_gateway_tester');
      assert.notEqual(data.gatewayInjectedHeaders['x-user-id'], 'attacker_impersonated_id');
      assert.equal(data.gatewayInjectedHeaders['x-user-roles'], 'Admin');
      assert.notEqual(data.gatewayInjectedHeaders['x-user-roles'], 'SuperAdmin,Root');
    });

    it('should reject unauthenticated request with 401 and gateway signature', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.gateway, 'AuthMatrix Edge Gateway Simulator');
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /Edge Validation Failed/);
    });

    it('should reject forged token signed with rogue secret with 401', async () => {
      const forgedToken = jwt.sign({ sub: 'hacker', roles: ['Admin'] }, 'rogue-untrusted-secret');
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: { Authorization: `Bearer ${forgedToken}` }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.gateway, 'AuthMatrix Edge Gateway Simulator');
      assert.match(data.message, /invalid signature/i);
    });

    it('should reject expired token with 401', async () => {
      const expiredToken = jwt.sign({ sub: 'expired_user', roles: ['Developer'] }, JWT_SECRET, { expiresIn: '-5m' });
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.message, /jwt expired/i);
    });

    it('should reject malformed Bearer token format', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.gateway, 'AuthMatrix Edge Gateway Simulator');
    });
  });
});
