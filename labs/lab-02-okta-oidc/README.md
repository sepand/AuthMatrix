# Lab 2 — Okta OIDC Authentication

> 🛡️ **Zero Trust Principle:** Verify Explicitly — every sign-in triggers a cryptographically signed token from Okta, validated server-side via JWKS before any session is granted.

**Duration:** ~45 minutes  
**Prerequisites:** Lab 1 complete · Active Okta Developer account (`developer.okta.com`)  
**What you will build:** A real Okta OIDC sign-in flow — browser → Okta → PKCE code exchange → RS256 token validation → role-mapped session.

---

## What Happens End-to-End

```
Browser                 Astro Server              Okta
   │                        │                       │
   │── Click "Sign in" ───► │                       │
   │                        │── Build /authorize ──►│
   │◄── Redirect to Okta ───│   (PKCE + state)      │
   │                        │                       │
   │── Login at Okta ──────────────────────────────►│
   │◄── Redirect /callback?code=... ────────────────│
   │                        │                       │
   │── GET /callback ──────►│                       │
   │                        │── POST /token ────────►│
   │                        │◄─ id_token + access_token
   │                        │                       │
   │                        │── Fetch JWKS ─────────►│
   │                        │◄─ Public Keys          │
   │                        │                       │
   │                        │   Verify RS256 sig     │
   │                        │   Extract groups[]     │
   │                        │   Map groups → roles   │
   │                        │   Create session JWT   │
   │◄── Set cookie ─────────│                       │
   │── GET /dashboard ─────►│                       │
```

---

## Part A — Okta Developer Tenant Setup

### Step 1: Create a free Okta Developer account

1. Go to **https://developer.okta.com/signup/**
2. Fill in your name, email, and company
3. Click **Sign up**
4. Check your email — click the activation link
5. Set your password

> ℹ️ Your Okta domain will be something like `dev-12345678.okta.com`. Keep this handy.

### Step 2: Log in to your Okta Admin Console

URL: **https://dev-XXXXXX-admin.okta.com** (with `-admin` in the URL)

You should see the Okta Admin Dashboard.

---

## Part B — Create the OIDC Application in Okta

### Step 3: Navigate to Applications

1. In the left sidebar, click **Applications**
2. Click **Applications** again (the sub-item)
3. Click the blue **Create App Integration** button

### Step 4: Select the application type

A dialog box appears:
1. Under **Sign-in method**, select **OIDC — OpenID Connect**
2. Under **Application type**, select **Web Application**
3. Click **Next**

### Step 5: Configure the app settings

Fill in the form:

| Field | Value |
|:------|:------|
| **App integration name** | `AuthMatrix Lab` |
| **Grant types** | ✅ Authorization Code (already checked) |
| **Sign-in redirect URIs** | `http://localhost:3000/api/auth/okta-callback` |
| **Sign-out redirect URIs** | `http://localhost:3000` |
| **Controlled access** | Select **Allow everyone in your organization to access** |

Click **Save**.

### Step 6: Record your credentials

After saving, you land on the app's **General** tab. You need:

| Value | Where to find it |
|:------|:----------------|
| **Client ID** | Listed on the General tab as "Client ID" |
| **Client Secret** | Click **Edit** → scroll to "CLIENT SECRETS" section |
| **Okta Domain** | Top-right of the Admin Console (e.g., `dev-12345678.okta.com`) |

> ⚠️ **Security:** Never commit your Client Secret to git. It goes in your local `.env` file only.

---

## Part C — Configure the Groups Claim

Okta's OIDC tokens do not include group membership by default. You must add a **custom claim** to include `groups`.

### Step 7: Navigate to the Authorization Server

1. In the left sidebar, click **Security**
2. Click **API**
3. Under **Authorization Servers**, click **default**

### Step 8: Add the groups claim

1. Click the **Claims** tab
2. Click **Add Claim**
3. Fill in the form:

| Field | Value |
|:------|:------|
| **Name** | `groups` |
| **Include in token type** | Access Token · Always |
| **Value type** | Groups |
| **Filter** | Matches regex: `.*` |
| **Include in** | Any scope |

4. Click **Create**

> 💡 The regex `.*` includes ALL groups. In production, filter to specific groups only.

### Step 9: Verify the issuer

Still on the Authorization Server page, note the **Issuer** field at the top. It will look like:

```
https://dev-XXXXXX.okta.com/oauth2/default
```

Copy this — it is your `OKTA_ISSUER`.

---

## Part D — Create Okta Groups and Assign Users

### Step 10: Create the AuthMatrix groups

1. In the left sidebar, click **Directory** → **Groups**
2. Click **Add Group** and create each group:

| Group Name | Description |
|:-----------|:------------|
| `Admin` | AuthMatrix Administrators |
| `Managers` | AuthMatrix Managers |
| `Developers` | AuthMatrix Developers |
| `Auditors` | AuthMatrix Auditors |

Create all four groups by repeating the **Add Group** action.

### Step 11: Assign your user to a group

1. Click on the **Admin** group you just created
2. Click the **People** tab
3. Click **Assign People**
4. Search for your user account name
5. Click the **+** icon next to your name
6. Click **Save**

> 📌 **How the mapping works:** When you log in, Okta includes `"groups": ["Admin", "Everyone"]` in the access token. The AuthMatrix app maps `"Admin"` → internal `Admin` role with all permissions.

---

## Part E — Configure Your Local Environment

### Step 12: Update your `.env` file

Open `c:\GitHub\Learn IDM\.env` in a text editor. Fill in the Okta section:

```env
# ── OKTA DEVELOPER SETTINGS ──────────────────────────────────────
OKTA_ISSUER=https://dev-XXXXXX.okta.com/oauth2/default
OKTA_CLIENT_ID=0oaXXXXXXXXXXXXXXXX
OKTA_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OKTA_REDIRECT_URI=http://localhost:3000/api/auth/okta-callback
```

Replace the `XXXXXX` values with your actual values from Step 6 and Step 9.

### Step 13: Restart the Astro server

Stop the Astro dev server (Ctrl+C) and restart it so it picks up the new `.env`:

```bash
npm run dev --workspace=apps/astro-frontend
```

---

## Part F — Test Okta Sign-In

### Step 14: Open the login page

Navigate to: **http://localhost:3000/login**

The Okta button should now show:
```
🔵 Sign in with Okta
✅ Configured
```

> If it still shows "⚠️ Set OKTA_ISSUER..." — the server hasn't picked up your `.env`. Make sure you restarted it and the file is named `.env` (not `.env.txt`).

### Step 15: Click "Sign in with Okta"

What happens:
1. The browser hits `/api/auth/okta-login` on the Astro server
2. The server generates a PKCE `code_verifier` and `code_challenge`
3. Sets two short-lived HttpOnly cookies: `okta_pkce_verifier` and `okta_oauth_state`
4. **Redirects your browser to Okta**

You should now see the **Okta login page**.

### Step 16: Authenticate at Okta

1. Enter your **Okta account email and password**
2. Complete MFA if prompted
3. Click **Sign In**

Okta redirects your browser back to:
```
http://localhost:3000/api/auth/okta-callback?code=XXXXXXXX&state=YYYYYYYY
```

### Step 17: Observe the callback processing

The Astro server's `okta-callback.ts` runs:

1. ✅ Validates `state` cookie matches URL parameter (CSRF check)
2. ✅ POSTs to `https://dev-XXXXX.okta.com/oauth2/default/v1/token` with the authorization code and `code_verifier`
3. ✅ Receives `id_token` (RS256 signed JWT)
4. ✅ Fetches Okta's JWKS from `https://dev-XXXXX.okta.com/oauth2/default/v1/keys`
5. ✅ Verifies the RS256 signature cryptographically
6. ✅ Extracts `groups[]` claim → maps to internal roles
7. ✅ Creates session JWT → sets `auth_token` HttpOnly cookie
8. ✅ Redirects to `/dashboard`

### Step 18: Verify on the Dashboard

On the dashboard you should see:

- **Identity Provider badge:** 🔵 **Okta**
- **Subject (sub):** `00u...` — Okta's user ID (format: `00u` + alphanumeric)
- **Email:** Your Okta account email
- **Issuer (iss):** `https://authmatrix.local` (our normalized internal issuer)
- **Assigned Roles:** The group you assigned yourself to (e.g., `Admin`)
- **Granted Permissions:** The permissions for that role

> 💡 Notice the issuer is `https://authmatrix.local` — not `dev-XXXXX.okta.com`. This is by design: the session token is our own normalized JWT, not the raw Okta token. The Okta token is validated and discarded server-side.

---

## Part G — Test Role-Based Access

### Step 19: Test API endpoints

On the Dashboard, click the API Endpoint Tester buttons. Since you logged in as **Admin** (from the Okta group you set up), all endpoints should return `200`.

### Step 20: Test with a different group (optional)

1. Log out
2. In Okta Admin → Directory → Groups, add yourself to `Developers` group instead
3. Remove yourself from `Admin` group
4. Sign back in with Okta
5. Dashboard should show role `Developer` with only `read:reports`, `execute:jobs` permissions
6. Clicking `POST /users` or `DELETE /audit` should return **403**

---

## Part H — Token Inspection

### Step 21: Inspect the JWT in the dashboard

On the Dashboard JWT Inspector panel:

**HEADER should show:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

> Why HS256? The **session token** stored in the cookie is our internal JWT signed with `JWT_SECRET`. The original Okta token (RS256) was validated server-side and converted to our normalized session format.

**PAYLOAD should show:**
```json
{
  "sub": "00uXXXXXXXXXXXXXXXX",
  "name": "Your Name",
  "email": "you@yourcompany.com",
  "roles": ["Admin"],
  "permissions": ["read:users", "write:users", ...],
  "idp": "okta",
  "iss": "https://authmatrix.local",
  "aud": "https://api.authmatrix.local"
}
```

### Step 22: Inspect the original Okta token (Advanced)

To see the raw RS256 token Okta issued, open browser DevTools during the sign-in:

1. Open DevTools → **Network** tab
2. Sign in with Okta
3. In the Network tab, look for the request to `/api/auth/okta-callback`
4. The `okta_pkce_verifier` cookie is visible in the Request Headers before it's deleted

Alternatively, add a temporary `console.log(tokens.id_token)` to `okta-callback.ts`, restart the server, sign in, and check the Astro server console output. Copy the token and paste it into https://jwt.io to see the raw Okta claims including `groups[]`.

---

## ✅ Lab 2 Complete — Validation Checklist

- [ ] Created Okta Developer account and Admin Console access
- [ ] Created OIDC Web Application in Okta with correct redirect URI
- [ ] Added `groups` claim to the `default` Authorization Server
- [ ] Created 4 Okta groups (Admin, Managers, Developers, Auditors)
- [ ] Assigned yourself to the Admin group
- [ ] Filled in `.env` with correct `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`
- [ ] Login page shows "✅ Configured" for Okta
- [ ] Clicked "Sign in with Okta" → redirected to Okta login page
- [ ] Authenticated at Okta → returned to dashboard
- [ ] Dashboard shows 🔵 Okta badge and correct email/role/permissions
- [ ] API endpoint tests show expected 200/403 responses per role
- [ ] JWT Inspector shows `"idp": "okta"` in payload

**Next:** [Lab 3 — Microsoft Entra ID OIDC](../lab-03-entra-oidc/README.md)  
**Or skip to:** [Lab 4 — Azure APIM API Gateway](../lab-04-azure-apim/README.md)
