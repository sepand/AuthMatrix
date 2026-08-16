import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { apiGatewaySimulator } from '../../apps/api-server/src/middleware/gatewaySimulator.js';
import type { Request, Response, NextFunction } from 'express';

const LOCAL_MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

function createGatewayMockContext(headers: Record<string, string | undefined> = {}) {
  const req = {
    headers: { ...headers },
  } as unknown as Request;

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

describe('Tier 1 Unit: APIM Edge Gateway Simulator Middleware', () => {
  const validPayload = {
    sub: 'usr_admin_999',
    roles: ['Admin', 'Manager'],
    permissions: ['read:users', 'write:users', 'read:reports'],
  };

  describe('Feature 11 / Zero Trust: Untrusted Header Stripping', () => {
    it('should strip spoofed x-user-id header from client request', () => {
      const token = jwt.sign(validPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({
        authorization: `Bearer ${token}`,
        'x-user-id': 'spoofed_hacker_id',
      });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-id'], 'usr_admin_999', 'Header must be replaced with token sub, not spoofed value');
    });

    it('should strip spoofed x-user-roles header from client request', () => {
      const token = jwt.sign(validPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({
        authorization: `Bearer ${token}`,
        'x-user-roles': 'SuperAdmin,Root',
      });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-roles'], 'Admin,Manager');
    });

    it('should strip spoofed x-user-permissions header from client request', () => {
      const token = jwt.sign(validPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({
        authorization: `Bearer ${token}`,
        'x-user-permissions': 'all:access,god:mode',
      });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-permissions'], 'read:users,write:users,read:reports');
    });

    it('should strip untrusted headers even if request fails validation', () => {
      const ctx = createGatewayMockContext({
        'x-user-id': 'spoofed_id',
        'x-user-roles': 'Admin',
        'x-user-permissions': 'delete:audit',
      });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.equal(ctx.req.headers['x-user-id'], undefined);
      assert.equal(ctx.req.headers['x-user-roles'], undefined);
      assert.equal(ctx.req.headers['x-user-permissions'], undefined);
    });
  });

  describe('Feature 11 / Zero Trust: Bearer Token Validation at Gateway Edge', () => {
    it('should reject missing Authorization header with 401 Unauthorized', () => {
      const ctx = createGatewayMockContext({});
      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.equal(ctx.getJsonBody().gateway, 'AuthMatrix Edge Gateway Simulator');
      assert.match(ctx.getJsonBody().message, /Missing or malformed/);
    });

    it('should reject non-Bearer scheme (e.g. Basic) with 401 Unauthorized', () => {
      const ctx = createGatewayMockContext({ authorization: 'Basic YWRtaW46cGFzc3dvcmQ=' });
      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.match(ctx.getJsonBody().message, /Missing or malformed/);
    });

    it('should reject expired JWT token with 401 Unauthorized', () => {
      const expiredToken = jwt.sign(validPayload, LOCAL_MOCK_SECRET, { expiresIn: '-10s' });
      const ctx = createGatewayMockContext({ authorization: `Bearer ${expiredToken}` });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.match(ctx.getJsonBody().message, /jwt expired/i);
    });

    it('should reject token signed with incorrect secret with 401 Unauthorized', () => {
      const forgedToken = jwt.sign(validPayload, 'wrong-unauthorized-secret-key-12345');
      const ctx = createGatewayMockContext({ authorization: `Bearer ${forgedToken}` });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
      assert.match(ctx.getJsonBody().message, /invalid signature/i);
    });

    it('should reject corrupted / malformed JWT string with 401', () => {
      const ctx = createGatewayMockContext({ authorization: 'Bearer not.a.valid.jwt.string' });
      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), false);
      assert.equal(ctx.getStatusCode(), 401);
    });
  });

  describe('Feature 11 / Zero Trust: Downstream Header Injection', () => {
    it('should correctly inject x-user-id, x-user-roles, and x-user-permissions on successful validation', () => {
      const token = jwt.sign(validPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({ authorization: `Bearer ${token}` });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-id'], 'usr_admin_999');
      assert.equal(ctx.req.headers['x-user-roles'], 'Admin,Manager');
      assert.equal(ctx.req.headers['x-user-permissions'], 'read:users,write:users,read:reports');
    });

    it('should handle token with empty roles and permissions gracefully', () => {
      const emptyPayload = { sub: 'usr_guest_000', roles: [], permissions: [] };
      const token = jwt.sign(emptyPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({ authorization: `Bearer ${token}` });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-id'], 'usr_guest_000');
      assert.equal(ctx.req.headers['x-user-roles'], '');
      assert.equal(ctx.req.headers['x-user-permissions'], '');
    });

    it('should handle token where roles/permissions are undefined', () => {
      const minimalPayload = { sub: 'usr_minimal' };
      const token = jwt.sign(minimalPayload, LOCAL_MOCK_SECRET, { expiresIn: '1h' });
      const ctx = createGatewayMockContext({ authorization: `Bearer ${token}` });

      apiGatewaySimulator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.wasNextCalled(), true);
      assert.equal(ctx.req.headers['x-user-id'], 'usr_minimal');
      assert.equal(ctx.req.headers['x-user-roles'], '');
      assert.equal(ctx.req.headers['x-user-permissions'], '');
    });
  });
});
