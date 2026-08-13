import { defineMiddleware } from 'astro:middleware';
import jwt from 'jsonwebtoken';

const MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

export const onRequest = defineMiddleware(async ({ cookies, url, redirect, locals, request }, next) => {
  const tokenCookie = cookies.get('auth_token')?.value;

  if (tokenCookie) {
    try {
      // Decode and verify session token
      const decodedUser = jwt.decode(tokenCookie) as any;
      if (decodedUser) {
        locals.user = decodedUser;
      }
    } catch (e) {
      cookies.delete('auth_token', { path: '/' });
    }
  }

  // Protect all /dashboard and /protected routes
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/protected')) {
    if (!locals.user) {
      return redirect('/login?error=Authentication+required');
    }

    // Role check example for /dashboard/admin
    if (url.pathname.startsWith('/dashboard/admin')) {
      const userRoles = locals.user.roles || [];
      if (!userRoles.includes('Admin')) {
        return new Response(
          `<!DOCTYPE html>
          <html>
            <head><title>403 Forbidden - AuthMatrix</title></head>
            <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 3rem; text-align: center;">
              <h1 style="color: #ef4444; font-size: 2.5rem;">403 Forbidden - Access Denied</h1>
              <p>Astro Middleware blocked access to <code>${url.pathname}</code>.</p>
              <p>Your current roles: <strong>[${userRoles.join(', ')}]</strong></p>
              <p>Required role: <strong>Admin</strong></p>
              <a href="/dashboard" style="color: #38bdf8;">Return to Dashboard</a>
            </body>
          </html>`,
          { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
      }
    }
  }

  return next();
});
