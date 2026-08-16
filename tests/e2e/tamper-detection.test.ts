import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { ensureServer, BASE_URL, JWT_SECRET } from '../helpers/server-helper.js';

describe('Tier 4 E2E: Adversarial Zero Trust Tamper Detection & Boundary Stress', () => {
  before(async () => {
    await ensureServer();
  });

  describe('Scenario 6: Token Signature Forgery & Cryptographic Tampering', () => {
    it('should reject a token with modified payload claims (privilege escalation attempt)', async () => {
      // Create a valid Developer token
      const validDevPayload = {
        sub: 'usr_dev_tamper',
        name: 'Dev User',
        email: 'dev@authmatrix.local',
        roles: ['Developer'],
        permissions: ['read:users', 'read:reports'],
      };
      const token = jwt.sign(validDevPayload, JWT_SECRET);

      // Split and tamper the payload part of the JWT
      const parts = token.split('.');
      const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      tamperedPayload.roles = ['Admin'];
      tamperedPayload.permissions = ['write:users', 'delete:audit', 'write:settings'];
      parts[1] = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
      const tamperedToken = parts.join('.');

      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tamperedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hacked: true }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
      assert.match(data.message, /invalid signature/i);
    });

    it('should reject an unsecured JWT with alg: "none" (CVE mitigation)', async () => {
      const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'hacker_none',
        roles: ['Admin'],
        permissions: ['write:users', 'delete:audit'],
      })).toString('base64url');
      const noneToken = `${noneHeader}.${payload}.`;

      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${noneToken}` }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    it('should reject an expired token (Zero Trust temporal boundary)', async () => {
      const expiredPayload = {
        sub: 'usr_expired_01',
        roles: ['Admin'],
        permissions: ['read:users', 'write:users'],
      };
      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET, { expiresIn: '-10s' });

      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.message, /jwt expired/i);
    });

    it('should reject a token signed with an unauthorized third-party secret', async () => {
      const rogueToken = jwt.sign(
        { sub: 'usr_rogue', roles: ['Admin'], permissions: ['write:settings'] },
        'completely-different-signing-key-99999'
      );

      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${rogueToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exploit: true }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.message, /invalid signature/i);
    });

    it('should reject malformed Authorization header with missing space or invalid prefix', async () => {
      const res1 = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: 'Bearer' }
      });
      assert.equal(res1.status, 401);

      const res2 = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: 'Token xyz123' }
      });
      assert.equal(res2.status, 401);
    });
  });

  describe('Scenario 6: Boundary Stress & Encoding Integrity', () => {
    const adminToken = jwt.sign({
      sub: 'usr_admin_stress',
      name: 'Stress Tester <script>alert(1)</script>',
      roles: ['Admin'],
      permissions: ['read:users', 'write:users', 'read:reports', 'write:reports'],
    }, JWT_SECRET, { expiresIn: '1h' });

    it('should handle special characters, unicode, and HTML tags in payload without server failure', async () => {
      const weirdTitle = `Report with emojis ⚡🔒 and symbols <>&"' / \\ \n\t and unicode 日本語`;
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: weirdTitle }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.report.title, weirdTitle);
    });

    it('should handle user creation with long strings and special email formats', async () => {
      const longName = 'A'.repeat(256);
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: longName,
          email: 'user+filter.test-123@sub.domain.authmatrix.local',
          role: 'Developer',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.user.name, longName);
    });
  });
});
