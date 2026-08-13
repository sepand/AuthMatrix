# Lab 1 — Local RBAC & JWT Fundamentals

> 🛡️ **Zero Trust Principle:** Least Privilege — every role gets only the permissions it needs. Verify Explicitly — every API call validates a signed token, not a network location.

**Duration:** ~30 minutes  
**Prerequisites:** Node.js 18+, this repo cloned  
**No IdP needed** — everything runs locally.

---

## Objective

By the end of this lab you will:
1. Start the Astro frontend and Express API server locally
2. Log in as four different roles (Admin, Manager, Developer, Auditor)
3. Test every API endpoint and observe which roles get 200 vs 403
4. Inspect the JWT token structure in the dashboard
5. Understand how Astro middleware and API middleware each enforce RBAC independently

---

## Part A — Start the Application

### Step 1: Copy the environment file

Open a terminal in the project root (`c:\GitHub\Learn IDM`):

```bash
copy .env.example .env
```

> ℹ️ For Lab 1, you do **not** need to fill in any IdP credentials. The defaults work as-is.

### Step 2: Install dependencies

```bash
npm install
```

Expected output: `added XXX packages`

### Step 3: Start the API server (Terminal 1)

Open a new terminal window:

```bash
npm run dev --workspace=apps/api-server
```

Expected output:
```
⚡ [AuthMatrix API Server] running at http://localhost:4000
   Public:    GET  http://localhost:4000/api/public
   Protected: GET  http://localhost:4000/api/protected/me  (requires Bearer token)
   Mock JWT:  POST http://localhost:4000/api/auth/mock-token { "role": "Admin" }
```

### Step 4: Start the Astro frontend (Terminal 2)

Open a second terminal window:

```bash
npm run dev --workspace=apps/astro-frontend
```

Expected output:
```
 astro  v5.x.x ready in XXX ms

  Local    http://localhost:3000/
```

### Step 5: Verify public API

Open a browser or run:

```bash
curl http://localhost:4000/api/public
```

Expected response:
```json
{
  "status": "online",
  "message": "⚡ AuthMatrix Public API — No authentication required",
  "timestamp": "2026-..."
}
```

✅ **Validation:** Both servers running and public endpoint responds. Continue to Part B.

---

## Part B — Log In as Each Role

### Step 6: Open the login page

Navigate to: **http://localhost:3000/login**

You should see:
- **Mode A: Local Role Simulator** — four role buttons
- **Mode B: Enterprise IdP** — Okta and Entra buttons showing "⚠️ Not configured" (expected for Lab 1)

### Step 7: Log in as Admin

Click **👑 Admin**.

**What happens:**
1. Browser POSTs to `/api/auth/login` with `role=Admin`
2. Server creates a signed HS256 JWT with Admin permissions
3. Sets an HttpOnly `auth_token` cookie
4. Redirects to `/dashboard`

**Verify on the dashboard:**
- Identity Provider shows: 💻 **Local Simulator**
- Assigned Roles: `Admin`
- Granted Permissions: `read:users`, `write:users`, `delete:users`, `read:reports`, `write:reports`, `write:settings`, `read:audit`, `delete:audit`, `execute:jobs`

---

## Part C — Test API Authorization (Full Matrix)

### Step 8: Use the API Endpoint Tester

On the Dashboard, scroll to **API Endpoint Tester**. Click each button and record the response status.

> 💡 **Tip:** The tester sends your current session token as `Authorization: Bearer <JWT>` to the API server.

#### Expected Results — Admin

| Endpoint | Method | Expected Status | Permission Required |
|:---------|:-------|:----------------|:--------------------|
| `/api/protected/me` | GET | ✅ **200** | (any auth) |
| `/api/protected/reports` | GET | ✅ **200** | `read:reports` |
| `/api/protected/reports` | POST | ✅ **200** | `write:reports` |
| `/api/protected/jobs` | GET | ✅ **200** | `execute:jobs` |
| `/api/protected/users` | POST | ✅ **200** | `write:users` |
| `/api/protected/audit` | GET | ✅ **200** | `read:audit` |
| `/api/protected/settings` | PUT | ✅ **200** | `write:settings` |
| `/api/protected/users/42` | DELETE | ✅ **200** | `delete:users` |
| `/api/protected/audit` | DELETE | ✅ **200** | `delete:audit` |

### Step 9: Log out and log in as Auditor

1. Click **Logout** in the top navigation
2. Click **🔍 Auditor** on the login page

#### Expected Results — Auditor

| Endpoint | Method | Expected Status | Reason |
|:---------|:-------|:----------------|:-------|
| `/api/protected/me` | GET | ✅ **200** | Any auth |
| `/api/protected/reports` | GET | ✅ **200** | `read:reports` ✓ |
| `/api/protected/audit` | GET | ✅ **200** | `read:audit` ✓ |
| `/api/protected/jobs` | GET | ❌ **403** | `execute:jobs` — Auditor doesn't have this |
| `/api/protected/users` | POST | ❌ **403** | `write:users` — not in Auditor permissions |
| `/api/protected/audit` | DELETE | ❌ **403** | `delete:audit` — Admin only |

### Step 10: Test role-based page access as Auditor

Try navigating directly to:

| URL | Expected | Reason |
|:----|:---------|:-------|
| `/dashboard` | ✅ Allowed | Auditor has dashboard access |
| `/dashboard/audit` | ✅ Allowed | Auditor + Admin can access |
| `/dashboard/reports` | ❌ **403 Forbidden** | Requires Manager, Developer, or Admin |
| `/dashboard/admin` | ❌ **403 Forbidden** | Admin only |

> 📌 **Zero Trust Observation:** Notice that `/dashboard/reports` blocks at the **Astro middleware** layer (before the page even renders), AND the API also returns 403 independently. These are two separate enforcement points.

### Step 11: Full Role/Endpoint Matrix

Repeat Steps 8-9 for Manager and Developer. Fill in this table:

| Endpoint | Admin | Manager | Developer | Auditor |
|:---------|:-----:|:-------:|:---------:|:-------:|
| GET /me | ✅ | ✅ | ✅ | ✅ |
| GET /reports | ✅ | ✅ | ✅ | ✅ |
| POST /reports | ✅ | ✅ | ❌ | ❌ |
| GET /users | ✅ | ✅ | ✅ | ❌ |
| POST /users | ✅ | ❌ | ❌ | ❌ |
| DELETE /users/:id | ✅ | ❌ | ❌ | ❌ |
| GET /jobs | ✅ | ❌ | ✅ | ❌ |
| GET /audit | ✅ | ❌ | ❌ | ✅ |
| DELETE /audit | ✅ | ❌ | ❌ | ❌ |
| PUT /settings | ✅ | ❌ | ❌ | ❌ |

---

## Part D — JWT Inspection

### Step 12: Inspect your JWT

Log in as any role. On the Dashboard, scroll to **JWT Inspector**.

You will see three panels:
1. **HEADER** — `{"alg": "HS256", "typ": "JWT"}`
2. **PAYLOAD** — your claims: `sub`, `email`, `roles`, `permissions`, `iss`, `aud`, `exp`
3. **RAW TOKEN** — the full `xxxxx.yyyyy.zzzzz` format

### Step 13: Verify the expiry claim

In the PAYLOAD panel, find `"exp"`. This is a Unix timestamp.

Convert it:
```javascript
// In browser DevTools console:
new Date(1755012345 * 1000).toLocaleString()
// Replace 1755012345 with your actual exp value
```

Expected: A timestamp 4 hours from now (session lifetime).

### Step 14: Decode the raw token at jwt.io

1. Copy the **RAW TOKEN** value from the inspector
2. Open **https://jwt.io** in a new tab
3. Paste the token in the **Encoded** box on the left
4. Observe the decoded header and payload on the right

> 🔑 **Try the signature verification:** In the "VERIFY SIGNATURE" section at jwt.io, enter `authmatrix-local-super-secret-key-2026` as the secret. The signature badge should turn **blue (verified)**.

### Step 15: Try forging a token (Educational)

At jwt.io, change `"roles": ["Developer"]` to `"roles": ["Admin"]` in the payload.

1. Copy the new token from jwt.io (it will have an invalid signature)
2. Open browser DevTools → Application → Cookies → delete `auth_token`
3. Set a new cookie named `auth_token` with the forged token value
4. Refresh the dashboard

**Expected:** You are logged out or see an error. The middleware runs:
```typescript
jwt.verify(tokenCookie, SESSION_SECRET) // throws — invalid signature
```

> 🛡️ **Zero Trust Validation:** Cryptographic signatures make tokens tamper-proof. Even if an attacker intercepts a token and modifies the payload, the signature no longer matches, and the server rejects it.

---

## ✅ Lab 1 Complete — Validation Checklist

- [ ] Both servers started successfully (ports 3000 and 4000)
- [ ] Logged in as all four roles
- [ ] Confirmed 200 vs 403 pattern for each role/endpoint combination
- [ ] Observed middleware 403 page for route-level blocking
- [ ] Inspected JWT header, payload, and expiry
- [ ] Verified token at jwt.io with the signing secret
- [ ] Attempted token forgery and confirmed rejection

**Next:** [Lab 2 — Okta OIDC Authentication](../lab-02-okta-oidc/README.md)
