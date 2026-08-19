import http from 'http';
import jwt from 'jsonwebtoken';

export const API_PORT = process.env.API_PORT || '4000';
export const BASE_URL = `http://localhost:${API_PORT}`;
export const JWT_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

let serverStarted = false;
let serverInstance: http.Server | null = null;

export async function ensureServer(): Promise<string> {
  if (serverStarted) return BASE_URL;

  // Check if server is already running on BASE_URL
  try {
    const res = await fetch(`${BASE_URL}/api/public`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      serverStarted = true;
      return BASE_URL;
    }
  } catch (e) {
    // Server not running yet, import it
  }

  try {
    const serverModule = await import('../../apps/api-server/src/index.ts');
    if (serverModule.app && !serverInstance) {
      serverInstance = serverModule.app.listen(parseInt(API_PORT, 10));
      serverInstance.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          serverInstance = null;
        }
      });
      serverStarted = true;
      return BASE_URL;
    }
    if (serverModule.server) {
      serverInstance = serverModule.server;
    }
    // Wait for server to become responsive
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      try {
        const res = await fetch(`${BASE_URL}/api/public`, { signal: AbortSignal.timeout(500) });
        if (res.ok) {
          serverStarted = true;
          return BASE_URL;
        }
      } catch (err) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } catch (err) {
    console.error('Failed to boot API server in test helper:', err);
  }

  return BASE_URL;
}

export async function closeServer(): Promise<void> {
  if (serverInstance) {
    await new Promise<void>((resolve) => {
      serverInstance?.close(() => {
        resolve();
      });
    });
    serverStarted = false;
    serverInstance = null;
  }
}

export function createMockToken(role: 'Admin' | 'Manager' | 'Developer' | 'Auditor' | string, options: {
  permissions?: string[];
  sub?: string;
  email?: string;
  name?: string;
  expiresIn?: string | number;
  secret?: string;
  algorithm?: jwt.Algorithm;
} = {}): string {
  const rolePermissionMatrix: Record<string, string[]> = {
    Admin: ['read:users','write:users','delete:users','read:reports','write:reports','write:settings','read:audit','delete:audit','execute:jobs'],
    Manager: ['read:users','read:reports','write:reports'],
    Developer: ['read:users','read:reports','execute:jobs'],
    Auditor: ['read:audit','read:reports'],
  };

  const permissions = options.permissions || rolePermissionMatrix[role] || ['read:reports'];
  const payload = {
    sub: options.sub || `usr_${role.toLowerCase()}_123`,
    name: options.name || `Test User (${role})`,
    email: options.email || `${role.toLowerCase()}@authmatrix.local`,
    roles: [role],
    permissions,
    idp: 'local',
    iss: 'https://authmatrix.local',
    aud: 'https://api.authmatrix.local',
  };

  return jwt.sign(payload, options.secret || JWT_SECRET, {
    expiresIn: (options.expiresIn ?? '2h') as any,
    algorithm: options.algorithm || 'HS256',
  });
}
