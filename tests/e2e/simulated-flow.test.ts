import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, BASE_URL, createMockToken } from '../helpers/server-helper.js';
import { buildOktaSessionToken, buildEntraSessionToken } from '../../apps/astro-frontend/src/lib/oidc.js';

describe('Tier 4 E2E: Developer, Manager, and Multi-IdP Federation Flows', () => {
  before(async () => {
    await ensureServer();
  });

  describe('Scenario 3: Developer Operational Workflow & Job Execution', () => {
    const devToken = createMockToken('Developer', { sub: 'usr_e2e_dev_01', name: 'Lead Developer' });

    it('Step 1: Developer reads technical and system reports', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${devToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.reports));
    });

    it('Step 2: Developer inspects running background jobs', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${devToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.runningJobs));
      assert.ok(data.runningJobs.length > 0);
    });

    it('Step 3: Developer views user directory for collaboration', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${devToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.users));
    });

    it('Step 4: Developer is blocked from publishing formal reports (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Dev Report' }),
      });
      assert.equal(res.status, 403);
    });

    it('Step 5: Developer is blocked from provisioning users (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Rogue User' }),
      });
      assert.equal(res.status, 403);
    });

    it('Step 6: Developer is blocked from modifying security settings (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaEnforced: false }),
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Scenario 4: Manager Reporting & Governance Review', () => {
    const mgrToken = createMockToken('Manager', { sub: 'usr_e2e_mgr_01', name: 'Engineering Manager' });

    it('Step 1: Manager reads user directory', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.users));
    });

    it('Step 2: Manager publishes quarterly team roadmap report', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mgrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Q4 IAM Engineering Roadmap & KPI Review' }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.report.title, 'Q4 IAM Engineering Roadmap & KPI Review');
    });

    it('Step 3: Manager reads back reports catalog', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Step 4: Manager is blocked from executing backend jobs (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Step 5: Manager is blocked from deleting users (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Scenario 5: Multi-IdP Federation (Okta & Entra ID) to API Execution', () => {
    it('Okta SecurityEngineers group user should be normalized to Admin and access Admin endpoints', async () => {
      const oktaClaims = {
        sub: 'okta_sec_01',
        email: 'secops@enterprise.org',
        name: 'SecOps Engineer',
        groups: ['SecurityEngineers', 'Everyone'],
        iss: 'https://dev-12345.okta.com/oauth2/default',
        aud: '0oa123456789',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const normalizedSessionJwt = buildOktaSessionToken(oktaClaims);

      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${normalizedSessionJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ policyUpdated: true }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.message, '✅ Settings updated (write:settings)');
    });

    it('Okta Managers group user should be normalized to Manager and blocked from Settings (403)', async () => {
      const oktaClaims = {
        sub: 'okta_mgr_01',
        email: 'dept_head@enterprise.org',
        name: 'Dept Head',
        groups: ['Managers'],
        iss: 'https://dev-12345.okta.com/oauth2/default',
        aud: '0oa123456789',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const normalizedSessionJwt = buildOktaSessionToken(oktaClaims);

      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${normalizedSessionJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ policyUpdated: true }),
      });

      assert.equal(res.status, 403);
    });

    it('Entra ID Developer App Role user should be normalized to Developer and access Jobs', async () => {
      const entraClaims = {
        sub: 'entra_dev_01',
        email: 'clouddev@enterprise.onmicrosoft.com',
        name: 'Cloud Developer',
        roles: ['Developer'],
        iss: 'https://login.microsoftonline.com/tenant-id/v2.0',
        aud: 'api://authmatrix-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const normalizedSessionJwt = buildEntraSessionToken(entraClaims);

      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${normalizedSessionJwt}` }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.runningJobs));
    });
  });
});
