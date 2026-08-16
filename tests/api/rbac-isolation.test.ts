import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, BASE_URL, createMockToken } from '../helpers/server-helper.js';

describe('Tier 2 API: Zero Trust RBAC Endpoint Isolation Matrix', () => {
  before(async () => {
    await ensureServer();
  });

  const adminToken = createMockToken('Admin');
  const managerToken = createMockToken('Manager');
  const developerToken = createMockToken('Developer');
  const auditorToken = createMockToken('Auditor');

  describe('Endpoint 1: GET /api/protected/me (Identity claim reflection)', () => {
    it('Admin should access /me with 200 and return identity claims', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.userClaims.roles[0], 'Admin');
    });

    it('Manager should access /me with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.userClaims.roles[0], 'Manager');
    });

    it('Developer should access /me with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.userClaims.roles[0], 'Developer');
    });

    it('Auditor should access /me with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.userClaims.roles[0], 'Auditor');
    });

    it('Unauthenticated request to /me should return 401 Unauthorized', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/me`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });
  });

  describe('Endpoint 2: GET /api/protected/reports (read:reports)', () => {
    it('Admin should access reports with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.reports));
    });

    it('Manager should access reports with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Developer should access reports with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Auditor should access reports with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Unauthenticated should return 401', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`);
      assert.equal(res.status, 401);
    });
  });

  describe('Endpoint 3: POST /api/protected/reports (write:reports)', () => {
    it('Admin should create report with 201 Created', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Admin Executive Summary' }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.report.title, 'Admin Executive Summary');
    });

    it('Manager should create report with 201 Created', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Manager Operational Review' }),
      });
      assert.equal(res.status, 201);
    });

    it('Developer should be rejected with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Developer Unauthorized Report' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
    });

    it('Auditor should be rejected with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auditorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Auditor Unauthorized Report' }),
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Endpoint 4: GET /api/protected/users (read:users)', () => {
    it('Admin should access users list with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.users));
    });

    it('Manager should access users list with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Developer should access users list with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 200);
    });

    it('Auditor should be rejected from users list with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
    });
  });

  describe('Endpoint 5: POST /api/protected/users (write:users)', () => {
    it('Admin should provision user with 201 Created', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Eve Test', email: 'eve@authmatrix.local', role: 'Developer' }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.user.name, 'Eve Test');
    });

    it('Manager should be denied user provisioning with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Manager Rogue User' }),
      });
      assert.equal(res.status, 403);
    });

    it('Developer should be denied user provisioning with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Dev Rogue User' }),
      });
      assert.equal(res.status, 403);
    });

    it('Auditor should be denied user provisioning with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auditorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Auditor Rogue User' }),
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Endpoint 6: DELETE /api/protected/users/:id (delete:users)', () => {
    it('Admin should delete user with 200 OK', async () => {
      // Create a user first to ensure self-contained test state
      const createRes = await fetch(`${BASE_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Temp User To Delete', email: 'temp_del@authmatrix.local' }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      const tempId = created.user.id;

      const res = await fetch(`${BASE_URL}/api/protected/users/${tempId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('delete:users'));
      assert.equal(data.deletedUser?.id, tempId);
    });

    it('Manager should be denied delete user with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Developer should be denied delete user with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Auditor should be denied delete user with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/users/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Endpoint 7: GET /api/protected/jobs (execute:jobs)', () => {
    it('Admin should access jobs with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.runningJobs));
    });

    it('Developer should access jobs with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.runningJobs));
    });

    it('Manager should be denied jobs with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Auditor should be denied jobs with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/jobs`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Endpoint 8: GET /api/protected/audit (read:audit)', () => {
    it('Admin should read audit log with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.events));
    });

    it('Auditor should read audit log with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.events));
    });

    it('Manager should be denied audit log with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Developer should be denied audit log with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Endpoint 9: DELETE /api/protected/audit (delete:audit - Admin highest risk)', () => {
    it('Manager should be denied audit purge with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Developer should be denied audit purge with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${developerToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Auditor should be denied audit purge with 403 Forbidden (preventing tampering)', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.equal(res.status, 403);
    });

    it('Admin should purge audit log with 200 OK', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/audit`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('audit events purged'));
    });
  });

  describe('Endpoint 10: PUT /api/protected/settings (write:settings)', () => {
    it('Admin should update settings with 200 OK', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaEnforced: true, sessionTimeoutMinutes: 15 }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.settings.mfaEnforced, true);
    });

    it('Manager should be denied settings update with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaEnforced: false }),
      });
      assert.equal(res.status, 403);
    });

    it('Developer should be denied settings update with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaEnforced: false }),
      });
      assert.equal(res.status, 403);
    });

    it('Auditor should be denied settings update with 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/protected/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auditorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfaEnforced: false }),
      });
      assert.equal(res.status, 403);
    });
  });
});
