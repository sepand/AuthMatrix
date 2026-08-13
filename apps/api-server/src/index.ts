import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { requireAuth, requirePermission, AuthenticatedRequest } from './middleware/auth.js';
import { apiGatewaySimulator } from './middleware/gatewaySimulator.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 4000;
const MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

app.use(cors());
app.use(express.json());

// Public Endpoint
app.get('/api/public', (req, res) => {
  res.json({
    status: 'online',
    message: 'Welcome to the AuthMatrix Public API Endpoint!',
    timestamp: new Date().toISOString()
  });
});

// Utility Endpoint for Phase 1 Local Learning: Issue mock JWTs for various roles
app.post('/api/auth/mock-token', (req, res) => {
  const { role = 'Developer' } = req.body;

  const rolePermissionMatrix: Record<string, string[]> = {
    Admin: ['read:users', 'write:users', 'delete:users', 'read:reports', 'write:settings', 'read:audit'],
    Manager: ['read:users', 'read:reports', 'write:reports'],
    Developer: ['read:users', 'read:reports', 'execute:jobs'],
    Auditor: ['read:reports', 'read:audit']
  };

  const permissions = rolePermissionMatrix[role] || ['read:reports'];

  const payload = {
    sub: `usr_${role.toLowerCase()}_123`,
    name: `Test User (${role})`,
    email: `${role.toLowerCase()}@authmatrix.local`,
    roles: [role],
    permissions,
    iss: 'https://authmatrix.local',
    aud: 'https://api.authmatrix.local'
  };

  const token = jwt.sign(payload, MOCK_SECRET, { expiresIn: '2h' });

  res.json({
    message: `Generated mock JWT token for role '${role}'`,
    role,
    permissions,
    token
  });
});

// Protected Endpoint: User Profile / Token Claims inspection
app.get('/api/protected/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Successfully authenticated token!',
    userClaims: req.user
  });
});

// Protected Endpoint: Reports (Requires 'read:reports' permission)
app.get('/api/protected/reports', requireAuth, requirePermission('read:reports'), (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Access granted to Protected Executive Reports',
    reports: [
      { id: 101, title: 'Q3 Security Audit Summary', classification: 'Confidential' },
      { id: 102, title: 'IAM Identity Lifecycle Metrics', classification: 'Internal' }
    ],
    requestedBy: req.user?.name
  });
});

// Protected Endpoint: User Management (Requires 'write:users' permission)
app.post('/api/protected/users', requireAuth, requirePermission('write:users'), (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'User successfully created in directory database',
    actionBy: req.user?.name,
    createdUser: req.body
  });
});

// Protected Endpoint: Audit Log Wipe (Requires 'delete:audit' permission - Admin Only)
app.delete('/api/protected/audit', requireAuth, requirePermission('delete:audit'), (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'CRITICAL: Audit log purged successfully',
    executedBy: req.user?.name,
    timestamp: new Date().toISOString()
  });
});

// Protected Endpoint: API Gateway Simulator (Edge JWT validation & Header Injection)
app.get('/api/gateway/protected-resource', apiGatewaySimulator, (req, res) => {
  res.json({
    message: 'Access granted via API Gateway Edge Perimeter Security!',
    gatewayInjectedHeaders: {
      'x-user-id': req.headers['x-user-id'],
      'x-user-roles': req.headers['x-user-roles'],
      'x-user-permissions': req.headers['x-user-permissions']
    },
    note: 'The API Gateway validated your JWT at the edge, stripped untrusted headers, and injected these verified claims for downstream microservices.'
  });
});

app.listen(PORT, () => {
  console.log(`⚡ [AuthMatrix API Server] running at http://localhost:${PORT}`);
});
