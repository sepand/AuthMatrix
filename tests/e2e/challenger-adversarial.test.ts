import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ensureServer, BASE_URL, JWT_SECRET, createMockToken } from '../helpers/server-helper.js';
import {
  buildOktaSessionToken,
  buildEntraSessionToken,
  validateIdToken,
} from '../../apps/astro-frontend/src/lib/oidc.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../../apps/astro-frontend/src/lib/pkce.js';

describe('Challenger 1: Comprehensive Adversarial Security & Stress Verification', () => {
  before(async () => {
    await ensureServer();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: ADVANCED CRYPTOGRAPHIC & TOKEN MANIPULATION ATTACKS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Token Verification & Cryptographic Attack Resilience', () => {
    it('ATTACK: Alg none attack with various case variants (none, None, NONE)', async () => {
      const variants = ['none', 'None', 'NONE', 'nOnE'];
      for (const alg of variants) {
        const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
          sub: 'attacker_none',
          roles: ['Admin'],
          permissions: ['write:users', 'delete:audit', 'write:settings'],
        })).toString('base64url');
        const noneToken = `${header}.${payload}.`;

        const res = await fetch(`${BASE_URL}/api/protected/settings`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${noneToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ exploit: true }),
        });

        assert.equal(res.status, 401, `Expected 401 for alg: ${alg}`);
        const body = await res.json();
        assert.equal(body.error, 'Unauthorized');
      }
    });

    it('ATTACK: Algorithm swap / HMAC key confusion with RSA public key', async () => {
      // Generate RSA Key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Attacker signs token using HS256 with the public key string as secret (CVE-2015-9235 attack)
      const confusedToken = jwt.sign(
        { sub: 'attacker_rsa_hs256', roles: ['Admin'], permissions: ['write:users', 'delete:audit'] },
        publicKey,
        { algorithm: 'HS256' }
      );

      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${confusedToken}` },
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /invalid signature/i);
    });

    it('ATTACK: Algorithm swap with unsupported asymmetric algorithms (ES256, PS256, HS512)', async () => {
      const unsupportedAlgs = ['ES256', 'PS256', 'HS512', 'RS512'];
      for (const alg of unsupportedAlgs) {
        const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: 'user_unsupported', roles: ['Admin'] })).toString('base64url');
        const fakeSig = Buffer.from('fakesig12345').toString('base64url');
        const token = `${header}.${payload}.${fakeSig}`;

        const res = await fetch(`${BASE_URL}/api/protected/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(res.status, 401);
      }
    });

    it('ATTACK: Token truncation and malformed structure fuzzing', async () => {
      const malformedCases = [
        '',
        'Bearer',
        'Bearer ',
        'Bearer invalid-token-string',
        'Bearer a.b',
        'Bearer a.b.c.d',
        'Bearer .',
        'Bearer ..',
        'Bearer eyJhbGciOiJIUzI1NiJ9..signature',
        'Bearer eyJhbGciOiJIUzI1NiJ9.invalid-json.signature',
        'Bearer notbase64!@#$.payload.sig',
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ', // Missing signature segment
        'Bearer ' + 'A'.repeat(10000), // Huge buffer
      ];

      for (const authHeader of malformedCases) {
        const headers: Record<string, string> = {};
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch(`${BASE_URL}/api/protected/me`, { headers });
        assert.equal(res.status, 401, `Failed to reject malformed header: ${authHeader}`);
        const data = await res.json();
        assert.equal(data.error, 'Unauthorized');
      }
    });

    it('ATTACK: Payload tampering with signature preservation (Privilege Escalation)', async () => {
      // Mint valid developer token
      const validToken = createMockToken('Developer');
      const [headerB64, payloadB64, sigB64] = validToken.split('.');

      // Parse payload and escalate to Admin
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      payload.roles = ['Admin'];
      payload.permissions = ['read:users', 'write:users', 'delete:users', 'delete:audit', 'write:settings'];
      payload.sub = 'usr_escalated_admin';

      const tamperedToken = `${headerB64}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sigB64}`;

      // Try calling admin endpoint
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tamperedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escalated: true }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /invalid signature/i);
    });

    it('ATTACK: Temporal boundary attack with expired token and future nbf', async () => {
      const expiredToken = jwt.sign(
        { sub: 'usr_past', roles: ['Admin'], exp: Math.floor(Date.now() / 1000) - 60 },
        JWT_SECRET
      );
      const res1 = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.equal(res1.status, 401);
      const data1 = await res1.json();
      assert.match(data1.message, /jwt expired/i);

      const futureToken = jwt.sign(
        { sub: 'usr_future', roles: ['Admin'], nbf: Math.floor(Date.now() / 1000) + 3600 },
        JWT_SECRET
      );
      const res2 = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${futureToken}` },
      });
      assert.equal(res2.status, 401);
      const data2 = await res2.json();
      assert.match(data2.message, /jwt not active/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: EXHAUSTIVE 10-ENDPOINT RBAC ISOLATION & PRIVILEGE ESCALATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Exhaustive 10-Endpoint RBAC Isolation Matrix', () => {
    const adminToken = createMockToken('Admin');
    const managerToken = createMockToken('Manager');
    const developerToken = createMockToken('Developer');
    const auditorToken = createMockToken('Auditor');
    const emptyRoleToken = createMockToken('None', { permissions: [], roles: [] } as any);
    const guestRoleToken = createMockToken('Guest', { permissions: ['read:public'], roles: ['Guest'] } as any);
    const lowercaseAdminToken = jwt.sign({ sub: 'usr_lower', roles: ['admin'], permissions: ['read:reports'] }, JWT_SECRET);

    interface EndpointSpec {
      name: string;
      method: string;
      path: string;
      body?: any;
      expectedAdmin: number;
      expectedManager: number;
      expectedDeveloper: number;
      expectedAuditor: number;
      expectedEmpty: number;
      expectedGuest: number;
      expectedLowerAdmin: number;
    }

    const endpoints: EndpointSpec[] = [
      {
        name: 'Endpoint 1: GET /api/protected/me',
        method: 'GET',
        path: '/api/protected/me',
        expectedAdmin: 200,
        expectedManager: 200,
        expectedDeveloper: 200,
        expectedAuditor: 200,
        expectedEmpty: 200,
        expectedGuest: 200,
        expectedLowerAdmin: 200,
      },
      {
        name: 'Endpoint 2: GET /api/protected/reports (read:reports)',
        method: 'GET',
        path: '/api/protected/reports',
        expectedAdmin: 200,
        expectedManager: 200,
        expectedDeveloper: 200,
        expectedAuditor: 200,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 200, // lowerAdmin has read:reports permission explicitly
      },
      {
        name: 'Endpoint 3: POST /api/protected/reports (write:reports)',
        method: 'POST',
        path: '/api/protected/reports',
        body: { title: 'Stress Report' },
        expectedAdmin: 201,
        expectedManager: 201,
        expectedDeveloper: 403,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 4: GET /api/protected/users (read:users)',
        method: 'GET',
        path: '/api/protected/users',
        expectedAdmin: 200,
        expectedManager: 200,
        expectedDeveloper: 200,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 5: POST /api/protected/users (write:users)',
        method: 'POST',
        path: '/api/protected/users',
        body: { name: 'Stress User', email: 'stress@authmatrix.local' },
        expectedAdmin: 201,
        expectedManager: 403,
        expectedDeveloper: 403,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 6: DELETE /api/protected/users/:id (delete:users)',
        method: 'DELETE',
        path: '/api/protected/users/2',
        expectedAdmin: 200,
        expectedManager: 403,
        expectedDeveloper: 403,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 7: GET /api/protected/jobs (execute:jobs)',
        method: 'GET',
        path: '/api/protected/jobs',
        expectedAdmin: 200,
        expectedManager: 403,
        expectedDeveloper: 200,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 8: GET /api/protected/audit (read:audit)',
        method: 'GET',
        path: '/api/protected/audit',
        expectedAdmin: 200,
        expectedManager: 403,
        expectedDeveloper: 403,
        expectedAuditor: 200,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 9: DELETE /api/protected/audit (delete:audit)',
        method: 'DELETE',
        path: '/api/protected/audit',
        expectedAdmin: 200,
        expectedManager: 403,
        expectedDeveloper: 403,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
      {
        name: 'Endpoint 10: PUT /api/protected/settings (write:settings)',
        method: 'PUT',
        path: '/api/protected/settings',
        body: { test: true },
        expectedAdmin: 200,
        expectedManager: 403,
        expectedDeveloper: 403,
        expectedAuditor: 403,
        expectedEmpty: 403,
        expectedGuest: 403,
        expectedLowerAdmin: 403,
      },
    ];

    for (const ep of endpoints) {
      it(`STRESS: Zero Trust isolation on ${ep.name}`, async () => {
        const makeReq = async (token?: string) => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          return fetch(`${BASE_URL}${ep.path}`, {
            method: ep.method,
            headers,
            body: ep.body ? JSON.stringify(ep.body) : undefined,
          });
        };

        // 1. Unauthenticated -> 401
        const unauthRes = await makeReq();
        assert.equal(unauthRes.status, 401, `${ep.name} unauthenticated must return 401`);

        // 2. Admin -> Expected
        const adminRes = await makeReq(adminToken);
        assert.equal(adminRes.status, ep.expectedAdmin, `${ep.name} Admin status mismatch`);

        // 3. Manager -> Expected
        const managerRes = await makeReq(managerToken);
        assert.equal(managerRes.status, ep.expectedManager, `${ep.name} Manager status mismatch`);

        // 4. Developer -> Expected
        const devRes = await makeReq(developerToken);
        assert.equal(devRes.status, ep.expectedDeveloper, `${ep.name} Developer status mismatch`);

        // 5. Auditor -> Expected
        const auditorRes = await makeReq(auditorToken);
        assert.equal(auditorRes.status, ep.expectedAuditor, `${ep.name} Auditor status mismatch`);

        // 6. Empty Role -> Expected
        const emptyRes = await makeReq(emptyRoleToken);
        assert.equal(emptyRes.status, ep.expectedEmpty, `${ep.name} Empty role status mismatch`);

        // 7. Guest Role -> Expected
        const guestRes = await makeReq(guestRoleToken);
        assert.equal(guestRes.status, ep.expectedGuest, `${ep.name} Guest role status mismatch`);

        // 8. Lowercase admin -> Expected (must NOT gain Admin wildcard permissions)
        const lowerRes = await makeReq(lowercaseAdminToken);
        assert.equal(lowerRes.status, ep.expectedLowerAdmin, `${ep.name} Lowercase admin role status mismatch`);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: APIM GATEWAY HEADER STRIPPING & ANTI-SPOOFING CHALLENGES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 3: APIM Gateway Edge Simulator Header Stripping', () => {
    it('ATTACK: Client spoofing X-User-* headers without Bearer token is rejected and stripped', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: {
          'X-User-Id': 'attacker_sub',
          'X-User-Roles': 'Admin',
          'X-User-Permissions': 'write:users,delete:audit',
        },
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /Edge Validation Failed/i);
    });

    it('ATTACK: Client spoofing X-User-* headers alongside a Developer token has headers overridden by verified token', async () => {
      const devToken = createMockToken('Developer');

      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: {
          Authorization: `Bearer ${devToken}`,
          'X-User-Id': 'evil_sub_injected',
          'X-User-Roles': 'Admin',
          'X-User-Permissions': 'delete:audit,write:settings',
          'x-user-id': 'evil_sub_injected_lower',
          'x-user-roles': 'Admin',
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.gatewayInjectedHeaders['x-user-id'], 'usr_developer_123');
      assert.equal(data.gatewayInjectedHeaders['x-user-roles'], 'Developer');
      assert.equal(data.gatewayInjectedHeaders['x-user-permissions'], 'read:users,read:reports,execute:jobs');
      // Verify attacker's fake 'Admin' role was NOT passed
      assert.ok(!data.gatewayInjectedHeaders['x-user-roles'].includes('Admin'));
    });

    it('ATTACK: Client sending forged token alongside spoofed headers is blocked at edge', async () => {
      const forgedToken = jwt.sign(
        { sub: 'attacker', roles: ['Admin'] },
        'wrong-secret-9999'
      );

      const res = await fetch(`${BASE_URL}/api/gateway/protected-resource`, {
        headers: {
          Authorization: `Bearer ${forgedToken}`,
          'X-User-Roles': 'Admin',
        },
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /invalid signature/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: ASTRO SSR MIDDLEWARE & SESSION COOKIE TAMPERING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 4: Astro SSR Middleware Cookie Tampering & Route Guards', () => {
    // Helper to simulate Astro SSR onRequest middleware execution
    async function runAstroMiddleware(options: {
      pathname: string;
      cookieValue?: string;
    }): Promise<{
      responseStatus: number;
      redirectUrl: string | null;
      deletedCookies: string[];
      localsUser: any;
      isNextCalled: boolean;
    }> {
      const deletedCookies: string[] = [];
      let redirectUrl: string | null = null;
      let nextCalled = false;

      const mockCookies = {
        get: (name: string) => {
          if (name === 'auth_token' && options.cookieValue) {
            return { value: options.cookieValue };
          }
          return undefined;
        },
        delete: (name: string, _opts?: any) => {
          deletedCookies.push(name);
        },
        set: (_name: string, _val: any, _opts?: any) => {},
        has: (name: string) => (name === 'auth_token' && !!options.cookieValue),
      };

      const mockUrl = new URL(`http://localhost:3000${options.pathname}`);
      const mockLocals: Record<string, any> = {};

      const mockRedirect = (path: string) => {
        redirectUrl = path;
        return new Response(null, { status: 302, headers: { Location: path } });
      };

      const mockNext = async () => {
        nextCalled = true;
        return new Response('OK', { status: 200 });
      };

      const ROUTE_GUARDS: Array<{ path: string; roles: string[] }> = [
        { path: '/dashboard/admin',   roles: ['Admin'] },
        { path: '/dashboard/audit',   roles: ['Admin', 'Auditor'] },
        { path: '/dashboard/reports', roles: ['Admin', 'Manager', 'Developer'] },
        { path: '/dashboard',         roles: ['Admin', 'Manager', 'Developer', 'Auditor'] },
        { path: '/protected',         roles: ['Admin', 'Manager', 'Developer', 'Auditor'] },
      ];

      // Simulate middleware step 1: session cookie verification
      const tokenCookie = mockCookies.get('auth_token')?.value;
      if (tokenCookie) {
        try {
          const decoded = jwt.verify(tokenCookie, JWT_SECRET) as any;
          if (decoded) {
            mockLocals.user = decoded;
          }
        } catch (e) {
          mockCookies.delete('auth_token', { path: '/' });
        }
      }

      // Simulate middleware step 2: route guard checks
      let result: Response | null = null;
      for (const guard of ROUTE_GUARDS) {
        if (!mockUrl.pathname.startsWith(guard.path)) continue;

        if (!mockLocals.user) {
          const returnTo = encodeURIComponent(mockUrl.pathname);
          result = mockRedirect(`/login?error=Authentication+required&returnTo=${returnTo}`);
          break;
        }

        const userRoles: string[] = mockLocals.user.roles || [];
        const hasRole = guard.roles.some(r => userRoles.includes(r));

        if (!hasRole) {
          result = new Response('403 Forbidden Access Denied', {
            status: 403,
            headers: { 'Content-Type': 'text/html' },
          });
          break;
        }

        break;
      }

      if (!result) {
        result = await mockNext();
      }

      return {
        responseStatus: result.status,
        redirectUrl,
        deletedCookies,
        localsUser: mockLocals.user,
        isNextCalled: nextCalled,
      };
    }

    it('TAMPER: Corrupt / random string cookie should be deleted and user redirected to login', async () => {
      const result = await runAstroMiddleware({
        pathname: '/dashboard/admin',
        cookieValue: 'completely_corrupt_non_jwt_session_cookie',
      });

      assert.equal(result.responseStatus, 302);
      assert.ok(result.redirectUrl?.includes('/login'));
      assert.ok(result.deletedCookies.includes('auth_token'));
      assert.equal(result.localsUser, undefined);
      assert.equal(result.isNextCalled, false);
    });

    it('TAMPER: Expired JWT in session cookie should be deleted and redirected to login', async () => {
      const expiredToken = jwt.sign(
        { sub: 'usr_expired_session', roles: ['Admin'], exp: Math.floor(Date.now() / 1000) - 120 },
        JWT_SECRET
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/reports',
        cookieValue: expiredToken,
      });

      assert.equal(result.responseStatus, 302);
      assert.ok(result.redirectUrl?.includes('/login'));
      assert.ok(result.deletedCookies.includes('auth_token'));
      assert.equal(result.localsUser, undefined);
    });

    it('TAMPER: Forged session cookie with wrong secret should be deleted and redirected to login', async () => {
      const forgedToken = jwt.sign(
        { sub: 'attacker_cookie', roles: ['Admin'] },
        'attacker-secret-key-12345'
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/admin',
        cookieValue: forgedToken,
      });

      assert.equal(result.responseStatus, 302);
      assert.ok(result.redirectUrl?.includes('/login'));
      assert.ok(result.deletedCookies.includes('auth_token'));
      assert.equal(result.localsUser, undefined);
    });

    it('AUTHORIZATION: Developer role attempting to access /dashboard/admin receives 403 Forbidden HTML', async () => {
      const devToken = jwt.sign(
        { sub: 'usr_dev_01', roles: ['Developer'] },
        JWT_SECRET
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/admin',
        cookieValue: devToken,
      });

      assert.equal(result.responseStatus, 403);
      assert.equal(result.isNextCalled, false);
      assert.equal(result.localsUser.roles[0], 'Developer');
    });

    it('AUTHORIZATION: Auditor role attempting to access /dashboard/reports receives 403 Forbidden', async () => {
      const auditorToken = jwt.sign(
        { sub: 'usr_aud_01', roles: ['Auditor'] },
        JWT_SECRET
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/reports',
        cookieValue: auditorToken,
      });

      assert.equal(result.responseStatus, 403);
      assert.equal(result.isNextCalled, false);
    });

    it('AUTHORIZATION: Auditor role accessing /dashboard/audit is granted access (200 / next)', async () => {
      const auditorToken = jwt.sign(
        { sub: 'usr_aud_01', roles: ['Auditor'] },
        JWT_SECRET
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/audit',
        cookieValue: auditorToken,
      });

      assert.equal(result.responseStatus, 200);
      assert.equal(result.isNextCalled, true);
    });

    it('AUTHORIZATION: Admin role accessing /dashboard/admin is granted access (200 / next)', async () => {
      const adminToken = jwt.sign(
        { sub: 'usr_admin_01', roles: ['Admin'] },
        JWT_SECRET
      );

      const result = await runAstroMiddleware({
        pathname: '/dashboard/admin',
        cookieValue: adminToken,
      });

      assert.equal(result.responseStatus, 200);
      assert.equal(result.isNextCalled, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: MULTI-IDP NORMALIZATION & PKCE INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 5: Multi-IdP Claim Normalization & PKCE Invariants', () => {
    it('Okta Normalization: deduplicates multiple admin-tier groups to single Admin role', () => {
      const claims = {
        sub: 'okta_user_1',
        email: 'admin@okta.local',
        groups: ['Admin', 'SecurityEngineers', 'Everyone'],
        iss: 'https://dev-123.okta.com',
        aud: 'https://api.authmatrix.local',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const sessionJwt = buildOktaSessionToken(claims);
      const verified = jwt.verify(sessionJwt, JWT_SECRET) as any;

      assert.deepEqual(verified.roles, ['Admin']);
      assert.equal(verified.idp, 'okta');
      assert.ok(verified.permissions.includes('write:users'));
      assert.ok(verified.permissions.includes('delete:audit'));
    });

    it('Okta Normalization: falls back to Developer role when no recognized groups are present', () => {
      const claims = {
        sub: 'okta_user_2',
        email: 'anon@okta.local',
        groups: ['Everyone', 'Sales-EMEA', 'AllEmployees'],
        iss: 'https://dev-123.okta.com',
        aud: 'https://api.authmatrix.local',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const sessionJwt = buildOktaSessionToken(claims);
      const verified = jwt.verify(sessionJwt, JWT_SECRET) as any;

      assert.deepEqual(verified.roles, ['Developer']);
      assert.ok(verified.permissions.includes('execute:jobs'));
      assert.ok(!verified.permissions.includes('write:users'));
    });

    it('Entra ID Normalization: filters untrusted app roles and keeps recognized roles', () => {
      const claims = {
        sub: 'entra_user_1',
        email: 'manager@entra.local',
        roles: ['Manager', 'UnrecognizedCustomRole', 'GlobalReader'],
        iss: 'https://login.microsoftonline.com/tenant/v2.0',
        aud: 'api://authmatrix-app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const sessionJwt = buildEntraSessionToken(claims);
      const verified = jwt.verify(sessionJwt, JWT_SECRET) as any;

      assert.deepEqual(verified.roles, ['Manager']);
      assert.equal(verified.idp, 'entra');
      assert.ok(verified.permissions.includes('write:reports'));
      assert.ok(!verified.permissions.includes('write:users'));
    });

    it('PKCE RFC 7636 Appendix B test vector strict validation', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const computedChallenge = generateCodeChallenge(verifier);
      assert.equal(computedChallenge, expectedChallenge);
    });

    it('PKCE and State generator random entropy and character set compliance', () => {
      for (let i = 0; i < 50; i++) {
        const verifier = generateCodeVerifier();
        assert.ok(verifier.length >= 43 && verifier.length <= 128);
        assert.match(verifier, /^[A-Za-z0-9_-]+$/);

        const challenge = generateCodeChallenge(verifier);
        assert.match(challenge, /^[A-Za-z0-9_-]+$/);

        const state = generateState();
        assert.equal(state.length, 32);
        assert.match(state, /^[0-9a-f]{32}$/);
      }
    });
  });
});
