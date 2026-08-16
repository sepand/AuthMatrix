import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { requireAuth, requirePermission, AuthenticatedRequest } from './middleware/auth.js';
import { apiGatewaySimulator } from './middleware/gatewaySimulator.js';

dotenv.config();

const app  = express();
const PORT = process.env.API_PORT || 4000;
const MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// ── Simulated Data Store (in-memory for labs) ─────────────────────────────────
const REPORTS_DB = [
  { id: 101, title: 'Q3 Security Audit Summary',       classification: 'Confidential', author: 'Admin' },
  { id: 102, title: 'IAM Identity Lifecycle Metrics',  classification: 'Internal',     author: 'Manager' },
  { id: 103, title: 'Zero Trust Adoption Scorecard',   classification: 'Confidential', author: 'Admin' },
];

const AUDIT_EVENTS_DB = [
  { id: 1, timestamp: new Date(Date.now() - 120000).toISOString(), level: 'INFO',    action: 'LOGIN',           user: 'admin@authmatrix.local',   result: 'SUCCESS' },
  { id: 2, timestamp: new Date(Date.now() - 90000).toISOString(),  level: 'WARNING', action: 'ACCESS_DENIED',   user: 'developer@authmatrix.local',result: 'DENIED'  },
  { id: 3, timestamp: new Date(Date.now() - 60000).toISOString(),  level: 'INFO',    action: 'REPORT_READ',     user: 'manager@authmatrix.local',  result: 'SUCCESS' },
  { id: 4, timestamp: new Date(Date.now() - 30000).toISOString(),  level: 'ERROR',   action: 'TOKEN_EXPIRED',   user: 'auditor@authmatrix.local',  result: 'DENIED'  },
  { id: 5, timestamp: new Date().toISOString(),                     level: 'INFO',    action: 'USER_PROVISIONED',user: 'admin@authmatrix.local',   result: 'SUCCESS' },
];

const USERS_DB = [
  { id: 1,  name: 'Alice Chen',    email: 'alice@authmatrix.local',  role: 'Admin',     status: 'Active'   },
  { id: 2,  name: 'Bob Martinez',  email: 'bob@authmatrix.local',    role: 'Manager',   status: 'Active'   },
  { id: 3,  name: 'Carol Smith',   email: 'carol@authmatrix.local',  role: 'Developer', status: 'Active'   },
  { id: 4,  name: 'Dan Watkins',   email: 'dan@authmatrix.local',    role: 'Auditor',   status: 'Suspended'},
];

// ── PUBLIC ENDPOINT ───────────────────────────────────────────────────────────
// No authentication required — anyone can call this
app.get(['/api/public', '/api/public/health'], (req, res) => {
  res.json({
    status:    'online',
    message:   '⚡ AuthMatrix Public API — No authentication required',
    timestamp: new Date().toISOString(),
    docs:      'https://github.com/sepand/AuthMatrix',
  });
});

// ── LAB UTILITY: Issue mock JWTs for local Phase 1 testing ───────────────────
app.post('/api/auth/mock-token', (req, res) => {
  const { role = 'Developer' } = req.body;

  const rolePermissionMatrix: Record<string, string[]> = {
    Admin:     ['read:users','write:users','delete:users','read:reports','write:reports','write:settings','read:audit','delete:audit','execute:jobs'],
    Manager:   ['read:users','read:reports','write:reports'],
    Developer: ['read:users','read:reports','execute:jobs'],
    Auditor:   ['read:audit','read:reports'],
  };

  const permissions = rolePermissionMatrix[role] || ['read:reports'];
  const payload = {
    sub: `usr_${role.toLowerCase()}_123`,
    name: `Test User (${role})`,
    email: `${role.toLowerCase()}@authmatrix.local`,
    roles: [role],
    permissions,
    idp: 'local',
    iss: 'https://authmatrix.local',
    aud: 'https://api.authmatrix.local',
  };

  const token = jwt.sign(payload, MOCK_SECRET, { expiresIn: '2h' });
  res.json({ message: `Mock JWT for role '${role}'`, role, permissions, token });
});

// ── PROTECTED: Identity — who am I? ──────────────────────────────────────────
// Scope: any authenticated user
app.get('/api/protected/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    message:    '✅ Authenticated — here are your identity claims',
    userClaims: req.user,
  });
});

// ── PROTECTED: Reports — READ ─────────────────────────────────────────────────
// Scope: read:reports (Manager, Developer, Admin)
app.get('/api/protected/reports', requireAuth, requirePermission('read:reports'), (req: AuthenticatedRequest, res) => {
  res.json({
    message:       '✅ Access granted to Reports (read:reports)',
    reports:       REPORTS_DB,
    requestedBy:   req.user?.name,
    count:         REPORTS_DB.length,
  });
});

// ── PROTECTED: Reports — WRITE ────────────────────────────────────────────────
// Scope: write:reports (Manager, Admin)
app.post('/api/protected/reports', requireAuth, requirePermission('write:reports'), (req: AuthenticatedRequest, res) => {
  const newReport = {
    id:             REPORTS_DB.length + 101 + 1,
    title:          req.body.title || 'Untitled Report',
    classification: 'Internal',
    author:         req.user?.name || 'unknown',
  };
  REPORTS_DB.push(newReport);
  res.status(201).json({
    message:     '✅ Report created (write:reports)',
    report:      newReport,
    createdBy:   req.user?.name,
  });
});

// ── PROTECTED: Users — READ ───────────────────────────────────────────────────
// Scope: read:users (Manager, Developer, Admin)
app.get('/api/protected/users', requireAuth, requirePermission('read:users'), (req: AuthenticatedRequest, res) => {
  res.json({
    message:     '✅ Access granted to Users list (read:users)',
    users:       USERS_DB,
    requestedBy: req.user?.name,
    count:       USERS_DB.length,
  });
});

// ── PROTECTED: Users — WRITE ──────────────────────────────────────────────────
// Scope: write:users (Admin only)
app.post('/api/protected/users', requireAuth, requirePermission('write:users'), (req: AuthenticatedRequest, res) => {
  const newUser = {
    id:     USERS_DB.length + 10,
    name:   req.body.name   || 'New User',
    email:  req.body.email  || 'new@authmatrix.local',
    role:   req.body.role   || 'Developer',
    status: 'Active',
  };
  USERS_DB.push(newUser);
  res.status(201).json({
    message:    '✅ User provisioned (write:users)',
    user:       newUser,
    createdBy:  req.user?.name,
    timestamp:  new Date().toISOString(),
  });
});

// ── PROTECTED: Users — DELETE ─────────────────────────────────────────────────
// Scope: delete:users (Admin only)
app.delete('/api/protected/users/:id', requireAuth, requirePermission('delete:users'), (req: AuthenticatedRequest, res) => {
  const id       = parseInt(String(req.params.id), 10);
  const idx      = USERS_DB.findIndex(u => u.id === id);
  const removed  = idx >= 0 ? USERS_DB.splice(idx, 1)[0] : null;
  res.json({
    message:     removed ? `✅ User ${id} deleted (delete:users)` : `⚠️ User ${id} not found`,
    deletedUser: removed,
    deletedBy:   req.user?.name,
    timestamp:   new Date().toISOString(),
  });
});

// ── PROTECTED: Jobs — EXECUTE ─────────────────────────────────────────────────
// Scope: execute:jobs (Developer, Admin)
app.get('/api/protected/jobs', requireAuth, requirePermission('execute:jobs'), (req: AuthenticatedRequest, res) => {
  res.json({
    message:     '✅ Access granted to Job Execution (execute:jobs)',
    runningJobs: [
      { id: 'job-001', name: 'Identity Sync',        status: 'running',   startedAt: new Date(Date.now() - 30000).toISOString() },
      { id: 'job-002', name: 'Certificate Rotation', status: 'scheduled', startedAt: null },
      { id: 'job-003', name: 'Audit Log Export',     status: 'completed', startedAt: new Date(Date.now() - 600000).toISOString() },
    ],
    requestedBy: req.user?.name,
  });
});

// ── PROTECTED: Audit Log — READ ───────────────────────────────────────────────
// Scope: read:audit (Auditor, Admin)
app.get('/api/protected/audit', requireAuth, requirePermission('read:audit'), (req: AuthenticatedRequest, res) => {
  res.json({
    message:     '✅ Access granted to Audit Log (read:audit)',
    events:      AUDIT_EVENTS_DB,
    requestedBy: req.user?.name,
    count:       AUDIT_EVENTS_DB.length,
  });
});

// ── PROTECTED: Audit Log — DELETE (Admin only) ────────────────────────────────
// Scope: delete:audit (Admin only — highest risk action in the system)
app.delete('/api/protected/audit', requireAuth, requirePermission('delete:audit'), (req: AuthenticatedRequest, res) => {
  const purged = AUDIT_EVENTS_DB.length;
  AUDIT_EVENTS_DB.length = 0; // clear array
  res.json({
    message:   `⚠️ CRITICAL: ${purged} audit events purged — this action is irreversible`,
    purgedBy:  req.user?.name,
    purgedAt:  new Date().toISOString(),
    count:     purged,
  });
});

// ── PROTECTED: Settings — WRITE ───────────────────────────────────────────────
// Scope: write:settings (Admin only)
app.put('/api/protected/settings', requireAuth, requirePermission('write:settings'), (req: AuthenticatedRequest, res) => {
  res.json({
    message:    '✅ Settings updated (write:settings)',
    updatedBy:  req.user?.name,
    settings:   req.body,
    timestamp:  new Date().toISOString(),
  });
});

// ── API GATEWAY SIMULATOR ─────────────────────────────────────────────────────
// Demonstrates the API Gateway header-injection pattern (ADR-SEC-2026-001)
app.get('/api/gateway/protected-resource', apiGatewaySimulator, (req, res) => {
  res.json({
    message: '✅ Access granted via API Gateway Edge perimeter!',
    gatewayInjectedHeaders: {
      'x-user-id':          req.headers['x-user-id'],
      'x-user-roles':       req.headers['x-user-roles'],
      'x-user-permissions': req.headers['x-user-permissions'],
    },
    note: 'The API Gateway simulator validated your JWT, stripped untrusted headers, and injected these verified claims. The backend never sees the raw token.',
  });
});

export { app };

export let server: ReturnType<typeof app.listen> | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`⚡ [AuthMatrix API Server] running at http://localhost:${PORT}`);
    console.log(`   Public:    GET  http://localhost:${PORT}/api/public`);
    console.log(`   Protected: GET  http://localhost:${PORT}/api/protected/me  (requires Bearer token)`);
    console.log(`   Mock JWT:  POST http://localhost:${PORT}/api/auth/mock-token { "role": "Admin" }`);
  });
}
