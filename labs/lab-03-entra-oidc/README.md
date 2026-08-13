# Lab 3 — Microsoft Entra ID OIDC Authentication

> 🛡️ **Zero Trust Principle:** Verify Explicitly — every sign-in triggers a cryptographically signed RS256 token from Entra, validated server-side via Microsoft's JWKS endpoint before any session is granted.

**Duration:** ~45 minutes  
**Prerequisites:** Lab 1 complete · Microsoft 365 or Azure subscription (free tier works) · Access to **portal.azure.com**  
**What you will build:** A real Entra ID OIDC sign-in flow using **App Roles** (not groups) — the enterprise-native role assignment model in Azure AD.

---

## Okta vs Entra: Key Difference in Role Model

| | Okta (Lab 2) | Entra ID (This Lab) |
|:---|:---|:---|
| **Role source** | `groups` claim (Okta Groups) | `roles` claim (Entra App Roles) |
| **Where roles are defined** | Okta Admin → Groups | Azure Portal → App Registration → Manifest |
| **Where roles are assigned** | User added to Okta Group | User/Group assigned to App Role in Enterprise App |
| **Token claim shape** | `"groups": ["Admin","Everyone"]` | `"roles": ["Admin"]` |
| **Transformation needed** | Group name → role name mapping | Direct — already uses internal vocabulary |

---

## What Happens End-to-End

```
Browser                 Astro Server              Entra ID
   │                        │                       │
   │── Click "Sign in" ───► │                       │
   │                        │── Build /authorize ──►│
   │◄── Redirect to Entra ──│   (PKCE + state)      │
   │                        │                       │
   │── Login at Entra ─────────────────────────────►│
   │◄── Redirect /callback?code=... ────────────────│
   │                        │                       │
   │── GET /callback ──────►│                       │
   │                        │── POST /token ─────────►│
   │                        │◄─ id_token (roles[])    │
   │                        │                       │
   │                        │── Fetch JWKS ──────────►│
   │                        │◄─ Microsoft Public Keys │
   │                        │                       │
   │                        │   Verify RS256 sig     │
   │                        │   Extract roles[]      │
   │                        │   (no mapping needed)  │
   │                        │   Create session JWT   │
   │◄── Set cookie ─────────│                       │
   │── GET /dashboard ─────►│                       │
```

---

## Part A — Azure App Registration Setup

### Step 1: Sign in to the Azure Portal

Go to: **https://portal.azure.com**

Sign in with your Microsoft account (personal, work, or school).

### Step 2: Navigate to Entra ID

1. In the top search bar, type **Microsoft Entra ID**
2. Click **Microsoft Entra ID** from the results

> Alternatively: In the left sidebar, look for **Azure Active Directory** (older name) or navigate directly to **https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade**

### Step 3: Record your Tenant ID

On the Entra ID Overview page, you will see:

- **Tenant ID** (also called Directory ID): A UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Copy and save this — you will need it for your `.env` file.

---

## Part B — Create the App Registration

### Step 4: Go to App registrations

1. In the left sidebar under Entra ID, click **App registrations**
2. Click **+ New registration**

### Step 5: Fill in the registration form

| Field | Value |
|:------|:------|
| **Name** | `AuthMatrix Lab` |
| **Supported account types** | Accounts in this organizational directory only (Single tenant) |
| **Redirect URI** | Select **Web** from the dropdown, then enter: `http://localhost:3000/api/auth/entra-callback` |

Click **Register**.

### Step 6: Record your Application (Client) ID

After registration, you land on the app's **Overview** page. Copy:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

This is your `ENTRA_CLIENT_ID`.

### Step 7: Create a Client Secret

1. In the left sidebar of your App Registration, click **Certificates & secrets**
2. Click **+ New client secret**
3. Fill in:
   - **Description:** `AuthMatrix Lab Secret`
   - **Expires:** 180 days (or 24 months for a longer lab)
4. Click **Add**
5. **IMMEDIATELY copy the `Value` column** — it is only shown once!

> ⚠️ **Critical:** The secret value is only visible immediately after creation. If you navigate away, you must create a new one. Save it in your `.env` file right now.

This is your `ENTRA_CLIENT_SECRET`.

---

## Part C — Define App Roles

Entra App Roles are defined directly in the App Registration manifest. This is different from Okta Groups — the roles are part of the application definition itself.

### Step 8: Open the App Roles configuration

1. In your App Registration left sidebar, click **App roles**
2. Click **+ Create app role**

### Step 9: Create the Admin role

Fill in the panel that appears on the right:

| Field | Value |
|:------|:------|
| **Display name** | `Admin` |
| **Allowed member types** | Users/Groups |
| **Value** | `Admin` |
| **Description** | `AuthMatrix system administrator with full access` |
| **Do you want to enable this app role?** | ✅ Yes |

Click **Apply**.

### Step 10: Create remaining roles

Repeat Step 9 three more times for:

| Display Name | Value | Description |
|:-------------|:------|:------------|
| `Manager` | `Manager` | AuthMatrix operational manager |
| `Developer` | `Developer` | AuthMatrix technical engineer |
| `Auditor` | `Auditor` | AuthMatrix read-only compliance auditor |

After creating all four, your App Roles tab should show:

```
✅ Admin       — Users/Groups — Enabled
✅ Manager     — Users/Groups — Enabled
✅ Developer   — Users/Groups — Enabled
✅ Auditor     — Users/Groups — Enabled
```

> 📌 **Why the `Value` field matters:** The `Value` is what appears in the `roles` claim of the token. Setting it to `Admin`, `Manager`, etc. means the token matches our internal role vocabulary exactly — no mapping table needed (unlike Okta groups).

---

## Part D — Assign Roles to Users via Enterprise Application

App Roles are assigned through the **Enterprise Application** object, not the App Registration.

### Step 11: Navigate to Enterprise Applications

1. Go back to **Microsoft Entra ID** main page
2. In the left sidebar, click **Enterprise applications**
3. Search for **AuthMatrix Lab**
4. Click on it

### Step 12: Assign yourself to the Admin role

1. In the left sidebar of the Enterprise App, click **Users and groups**
2. Click **+ Add user/group**
3. Under **Users**, click **None selected**
4. Search for your own user account name
5. Click on your name to select it → click **Select**
6. Under **Select a role**, click **None selected**
7. Select **Admin** from the list → click **Select**
8. Click **Assign**

You should now see your user listed with role **Admin**.

> 💡 **For testing different roles:** Repeat this step to assign yourself to another role. Note that a user can have multiple App Roles simultaneously.

---

## Part E — Configure API Permissions (for roles claim)

By default, Entra includes the `roles` claim in access tokens when App Roles are assigned. However, you need to ensure the token is issued with the right audience.

### Step 13: Expose an API scope

1. Go back to your **App Registration** (not Enterprise App)
2. In the left sidebar, click **Expose an API**
3. Next to **Application ID URI**, click **Add** (or it may auto-populate as `api://your-client-id`)
4. Accept the default URI or set it to `api://authmatrix-lab`
5. Click **Save**

The `Application ID URI` is your API's audience. This matches what goes in `ENTRA_CLIENT_ID` for the audience check.

### Step 14: Verify token configuration

1. In the left sidebar, click **Token configuration**
2. If you want the `roles` claim in **ID tokens** as well (for easier inspection):
   - Click **+ Add optional claim**
   - Select **ID**
   - Check `roles`
   - Click **Add**

> ℹ️ The `roles` claim is automatically included in **access tokens** when App Roles are assigned. This step adds it to ID tokens for inspection purposes.

---

## Part F — Configure Your Local Environment

### Step 15: Update your `.env` file

Open `c:\GitHub\Learn IDM\.env`. Fill in the Entra section:

```env
# ── MICROSOFT ENTRA ID SETTINGS ──────────────────────────────────
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ENTRA_REDIRECT_URI=http://localhost:3000/api/auth/entra-callback
```

Replace values with what you recorded in Steps 3, 6, and 7.

### Step 16: Restart the Astro server

Stop the Astro dev server (Ctrl+C) and restart:

```bash
npm run dev --workspace=apps/astro-frontend
```

---

## Part G — Test Entra ID Sign-In

### Step 17: Open the login page

Navigate to: **http://localhost:3000/login**

The Entra button should now show:
```
🔷 Sign in with Microsoft Entra ID
✅ Configured
```

### Step 18: Click "Sign in with Microsoft Entra ID"

What happens on the server:
1. `/api/auth/entra-login` generates PKCE `code_verifier` + `code_challenge`
2. Sets `entra_pkce_verifier` and `entra_oauth_state` HttpOnly cookies
3. Redirects browser to:

```
https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/api/auth/entra-callback
  &scope=openid profile email api://YOUR_CLIENT_ID/.default
  &state=RANDOM_HEX
  &code_challenge=SHA256_HASH
  &code_challenge_method=S256
```

You should see the **Microsoft sign-in page**.

### Step 19: Authenticate at Microsoft

1. Enter your **Microsoft account email**
2. Enter your password
3. Complete MFA if prompted
4. If asked **"AuthMatrix Lab is requesting access to..."** — click **Accept**

Microsoft redirects your browser back to:
```
http://localhost:3000/api/auth/entra-callback?code=XXXXXXXX&state=YYYYYYYY
```

### Step 20: Observe the callback processing

The Astro server's `entra-callback.ts` runs:

1. ✅ Validates `state` cookie (CSRF protection)
2. ✅ POSTs to `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
3. ✅ Receives `id_token` (RS256 signed by Microsoft)
4. ✅ Fetches JWKS from `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`
5. ✅ Verifies RS256 signature using Microsoft's public key
6. ✅ Extracts `roles[]` claim — no mapping needed, already matches internal vocabulary
7. ✅ Creates normalized session JWT → sets `auth_token` HttpOnly cookie
8. ✅ Redirects to `/dashboard`

### Step 21: Verify on the Dashboard

On the dashboard you should see:

- **Identity Provider badge:** 🔷 **Microsoft Entra**
- **Subject (sub):** A UUID like `a1b2c3d4-...` (Entra Object ID format — different from Okta's `00u...` format)
- **Email:** Your Microsoft account email
- **Assigned Roles:** `Admin` (the App Role you assigned in Step 12)
- **Granted Permissions:** All Admin permissions

> 💡 **Compare with Okta (Lab 2):** The `sub` claim format is different. Okta uses `00uXXXX...`; Entra uses a UUID. Both are normalized into the same session token structure by the AuthMatrix app.

---

## Part H — Test Role-Based Access

### Step 22: Test API endpoints

On the Dashboard API Tester, click each endpoint. Since you're assigned the **Admin** App Role, all should return 200.

### Step 23: Change your role assignment (test Auditor)

1. Go back to **Azure Portal** → **Entra ID** → **Enterprise Applications** → **AuthMatrix Lab**
2. Click **Users and groups**
3. Click on your existing assignment → click **Edit assignment**
4. Under **Select a role**, choose **Auditor** instead
5. Click **Assign**
6. Log out of AuthMatrix → sign back in with Entra
7. Dashboard should now show role `Auditor`
8. Clicking `DELETE /audit` → returns **403 Forbidden** ✅ (Auditor can read, not delete)

### Step 24: Full Role/Endpoint Matrix (Entra)

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

## Part I — Token Inspection

### Step 25: Inspect raw Entra ID token (Advanced)

To see the actual RS256 token Microsoft issued:

1. Open browser DevTools → **Network** tab
2. Sign in with Entra
3. Find the request to `/api/auth/entra-callback` in the Network tab
4. Alternatively, temporarily add `console.log(tokens.id_token)` to `entra-callback.ts`, restart the Astro server, and check the terminal output

Copy the token → paste at **https://jwt.io**

You should see in the raw payload:
```json
{
  "iss": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
  "aud": "YOUR_CLIENT_ID",
  "roles": ["Admin"],
  "email": "you@yourdomain.com",
  "name": "Your Name",
  "sub": "uuid-format-subject",
  "tid": "YOUR_TENANT_ID"
}
```

### Step 26: Compare with your session token

In the dashboard JWT Inspector, your **session token** (what's stored in the cookie) shows:

```json
{
  "iss": "https://authmatrix.local",
  "idp": "entra",
  "roles": ["Admin"],
  "permissions": ["read:users", "write:users", ...]
}
```

> 🛡️ **Zero Trust Observation:** The raw Entra token with Microsoft's issuer, tenant ID, and audience is validated and discarded server-side. The session token uses our normalized `authmatrix.local` issuer. The backend API only trusts this internal token — it never receives nor validates Entra tokens directly.

---

## ✅ Lab 3 Complete — Validation Checklist

- [ ] Signed into Azure Portal and found Tenant ID
- [ ] Created App Registration `AuthMatrix Lab` with correct redirect URI
- [ ] Created and saved Client Secret (copied immediately after creation)
- [ ] Defined 4 App Roles: Admin, Manager, Developer, Auditor
- [ ] Assigned own user to Admin role via Enterprise Application → Users and groups
- [ ] Exposed API and set Application ID URI
- [ ] Filled in `.env` with ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET
- [ ] Login page shows "✅ Configured" for Entra
- [ ] Clicked "Sign in with Microsoft Entra ID" → redirected to Microsoft login
- [ ] Authenticated → returned to dashboard with 🔷 Entra badge
- [ ] Dashboard shows correct email, `roles: ["Admin"]`, all permissions
- [ ] Changed App Role to Auditor → confirmed 403 on DELETE /audit
- [ ] Compared raw Entra `roles[]` claim with normalized session token

**Next:** [Lab 4 — Azure APIM API Gateway](../lab-04-azure-apim/README.md)
