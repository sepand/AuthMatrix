import { defineMiddleware } from 'astro:middleware';
import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

// ── Route Permission Matrix ────────────────────────────────────────────────────
// Maps URL path prefixes to the minimum roles required to access them.
// Zero Trust: Least Privilege — every protected route declares its minimum role.
const ROUTE_GUARDS: Array<{ path: string; roles: string[] }> = [
  { path: '/dashboard/admin',   roles: ['Admin'] },
  { path: '/dashboard/audit',   roles: ['Admin', 'Auditor'] },
  { path: '/dashboard/reports', roles: ['Admin', 'Manager', 'Developer'] },
  { path: '/dashboard',         roles: ['Admin', 'Manager', 'Developer', 'Auditor'] },
  { path: '/protected',         roles: ['Admin', 'Manager', 'Developer', 'Auditor'] },
];

export const onRequest = defineMiddleware(async ({ cookies, url, redirect, locals }, next) => {

  // ── Authenticate: verify session cookie ────────────────────────────────────
  const tokenCookie = cookies.get('auth_token')?.value;

  if (tokenCookie) {
    try {
      const decoded = jwt.verify(tokenCookie, SESSION_SECRET) as any;
      if (decoded) {
        locals.user = decoded;
      }
    } catch (e) {
      // Token expired or tampered — clear it (Zero Trust: Assume Breach)
      cookies.delete('auth_token', { path: '/' });
    }
  }

  // ── Authorize: enforce route guards ────────────────────────────────────────
  for (const guard of ROUTE_GUARDS) {
    if (!url.pathname.startsWith(guard.path)) continue;

    // Not authenticated at all → send to login
    if (!locals.user) {
      const returnTo = encodeURIComponent(url.pathname);
      return redirect(`/login?error=Authentication+required&returnTo=${returnTo}`);
    }

    // Authenticated but missing required role → 403
    const userRoles: string[] = locals.user.roles || [];
    const hasRole = guard.roles.some(r => userRoles.includes(r));

    if (!hasRole) {
      return new Response(forbidden403Html(url.pathname, userRoles, guard.roles), {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    break; // First matching guard wins — no need to check further
  }

  return next();
});

// ── 403 Forbidden Response HTML ────────────────────────────────────────────────
function forbidden403Html(path: string, userRoles: string[], requiredRoles: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>403 Forbidden — AuthMatrix</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family:'Plus Jakarta Sans',sans-serif; background:#090d16; color:#f3f4f6;
           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .card { background:#111827; border:1px solid #1f293d; border-radius:16px;
            padding:3rem; max-width:500px; width:90%; text-align:center; }
    h1  { color:#f87171; font-size:2rem; margin-bottom:0.5rem; }
    .sub { color:#9ca3af; margin-bottom:2rem; font-size:0.95rem; }
    .detail { background:#090d16; border-radius:8px; padding:1rem; text-align:left;
              font-size:0.85rem; margin-bottom:1.5rem; }
    .detail p { margin:0.4rem 0; }
    .tag { display:inline-block; padding:0.2rem 0.6rem; border-radius:6px;
           font-size:0.75rem; font-weight:700; }
    .tag-red  { background:rgba(248,113,113,0.15); color:#f87171; }
    .tag-blue { background:rgba(56,189,248,0.15);  color:#38bdf8; margin-right:0.3rem; }
    a { display:inline-block; margin-top:1rem; padding:0.6rem 1.4rem;
        background:#38bdf8; color:#0f172a; text-decoration:none;
        border-radius:8px; font-weight:700; font-size:0.9rem; }
    a:hover { background:#0284c7; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:3rem;margin-bottom:1rem">🚫</div>
    <h1>403 — Access Denied</h1>
    <p class="sub">Astro middleware blocked access. Zero Trust: Least Privilege enforced.</p>
    <div class="detail">
      <p><strong>Requested path:</strong> <code style="color:#38bdf8">${path}</code></p>
      <p><strong>Your roles:</strong> ${userRoles.map(r => `<span class="tag tag-red">${r}</span>`).join(' ')}</p>
      <p><strong>Required roles:</strong> ${requiredRoles.map(r => `<span class="tag tag-blue">${r}</span>`).join('')}</p>
    </div>
    <p style="color:#9ca3af;font-size:0.82rem">
      💡 <strong>Lab Tip:</strong> Log in as a role that has access, or configure your IdP to assign the correct role.
    </p>
    <a href="/dashboard">← Return to Dashboard</a>
  </div>
</body>
</html>`;
}
