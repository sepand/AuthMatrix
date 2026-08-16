import type { APIRoute } from 'astro';
import jwt from 'jsonwebtoken';

const MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const role = formData.get('role')?.toString() || 'Developer';

  const rolePermissionMatrix: Record<string, string[]> = {
    Admin: ['read:users', 'write:users', 'delete:users', 'read:reports', 'write:reports', 'write:settings', 'read:audit', 'delete:audit', 'execute:jobs'],
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

  const token = jwt.sign(payload, MOCK_SECRET, { expiresIn: '4h' });

  // Set HTTP-only auth token cookie
  cookies.set('auth_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 4
  });

  return redirect('/dashboard');
};
