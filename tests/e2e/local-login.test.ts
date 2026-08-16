import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, BASE_URL, createMockToken } from '../helpers/server-helper.js';

describe('Tier 4 E2E: Local Login & User Management Lifecycle Scenarios', () => {
  before(async () => {
    await ensureServer();
  });

  describe('Scenario 1: Full Administrator Enterprise Management Lifecycle', () => {
    const adminToken = createMockToken('Admin', { sub: 'usr_e2e_admin_01', name: 'E2E Admin User' });
    let createdUserId: number;

    it('Step 1: Authenticate and verify admin identity claims', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.userClaims.sub, 'usr_e2e_admin_01');
      assert.deepEqual(data.userClaims.roles, ['Admin']);
      assert.ok(data.userClaims.permissions.includes('write:users'));
    });

    it('Step 2: Provision a new user into the directory', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sarah Connor',
          email: 'sconnor@authmatrix.local',
          role: 'Developer',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.user.name, 'Sarah Connor');
      assert.equal(data.user.email, 'sconnor@authmatrix.local');
      createdUserId = data.user.id;
      assert.ok(createdUserId > 0);
    });

    it('Step 3: Retrieve user directory and verify newly provisioned user', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const found = data.users.find((u: any) => u.id === createdUserId);
      assert.ok(found, 'Created user must be found in directory');
      assert.equal(found.name, 'Sarah Connor');
    });

    it('Step 4: Publish a high-priority executive security report', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'FY2026 Enterprise Zero Trust Compliance Assessment',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.report.title, 'FY2026 Enterprise Zero Trust Compliance Assessment');
    });

    it('Step 5: Verify reports catalog contains published report', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const match = data.reports.find((r: any) => r.title.includes('Zero Trust Compliance'));
      assert.ok(match, 'Published report must appear in reports list');
    });

    it('Step 6: Update global security policy settings', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requireMfa: true,
          allowedIdps: ['okta', 'entra'],
          maxSessionDurationHours: 8,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.settings.requireMfa, true);
      assert.deepEqual(data.settings.allowedIdps, ['okta', 'entra']);
    });

    it('Step 7: Inspect system audit log before maintenance', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.events));
    });

    it('Step 8: Execute privileged audit log purge', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('audit events purged'));
    });

    it('Step 9: Deprovision the temporary user and clean up directory', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users/${createdUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('deleted'));
    });
  });

  describe('Scenario 2: Auditor Compliance Review & Write-Action Denial', () => {
    const auditorToken = createMockToken('Auditor', { sub: 'usr_e2e_auditor_01', name: 'Compliance Auditor' });

    it('Step 1: Auditor successfully inspects audit logs', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.events));
    });

    it('Step 2: Auditor successfully reads compliance reports', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.reports));
    });

    it('Step 3: Auditor is blocked from creating a user (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auditorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Auditor Created User' }),
      });
      assert.equal(res.status, 403);
    });

    it('Step 4: Auditor is blocked from purging audit logs (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Step 5: Auditor is blocked from modifying security settings (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auditorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requireMfa: false }),
      });
      assert.equal(res.status, 403);
    });
  });
});
