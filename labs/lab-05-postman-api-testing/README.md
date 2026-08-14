# Lab 5 — API Testing with Postman

> Test every AuthMatrix API endpoint across all four roles using three authentication strategies: **Local mock tokens**, **Okta OAuth 2.0**, and **Microsoft Entra OAuth 2.0**.

**Duration:** ~30 minutes  
**Prerequisites:** Lab 1 complete (API server running on port 4000)  
**Tools:** [Postman](https://www.postman.com/downloads/) (free desktop app)

---

## Import the Collection

1. Open Postman
2. Click **Import** (top left)
3. Drag and drop this file:
   ```
   labs/lab-05-postman-api-testing/AuthMatrix.postman_collection.json
   ```
4. Click **Import**

You will see the **AuthMatrix API Testing** collection in the left sidebar with all folders and requests pre-built.

---

## Strategy 1 — Local Mock Tokens (No IdP Required)

This is the fastest way to test all four roles. The API server issues signed JWTs on demand for any role.

### Step 1: Start the API server

```bash
npm run dev --workspace=apps/api-server
```

### Step 2: Run the mock token requests

Open the folder **"🔑 Step 0 — Get Mock Tokens"** in the collection.

Run each of the four requests in order:

| Request | Role | What it does |
|:--------|:-----|:-------------|
| Get Admin Token | Admin | Saves JWT to `token_admin` collection variable |
| Get Manager Token | Manager | Saves JWT to `token_manager` |
| Get Developer Token | Developer | Saves JWT to `token_developer` |
| Get Auditor Token | Auditor | Saves JWT to `token_auditor` |

Each request automatically runs a **test script** that saves the token:
```javascript
// Auto-runs after each mock-token response:
pm.collectionVariables.set('token_admin', data.token);
```

After running all four, check **Collection Variables** (click the collection name → Variables tab). You should see all four token variables populated.

### Step 3: Switch the active token by role

The collection uses `{{active_token}}` as the active bearer token in all protected requests.

To test as a specific role, set `active_token` to the role's token:

**Option A — In Collection Variables:**
1. Click the collection name → **Variables** tab
2. Find `active_token`
3. Change its **Current Value** to `{{token_manager}}` (or whichever role)

**Option B — In individual request Authorization tab:**
1. Open any request → **Authorization** tab
2. Change `Bearer {{active_token}}` to `Bearer {{token_developer}}`

### Step 4: Run requests and observe 200 vs 403

Work through the folders:

#### 📊 Reports

| Request | Admin | Manager | Developer | Auditor |
|:--------|:-----:|:-------:|:---------:|:-------:|
| GET /reports | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| POST /reports | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 403 |

1. Set `active_token = {{token_developer}}`
2. Send **POST /reports**
3. Expected response:
   ```json
   {
     "error": "Forbidden",
     "message": "Insufficient permissions. Required: write:reports. Your permissions: read:users, read:reports, execute:jobs"
   }
   ```
4. Set `active_token = {{token_manager}}`
5. Send **POST /reports** again
6. Expected: `201 Created` with the new report

#### 👥 Users

| Request | Admin | Manager | Developer | Auditor |
|:--------|:-----:|:-------:|:---------:|:-------:|
| GET /users | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 |
| POST /users | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |
| DELETE /users/:id | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |

#### ⚙️ Jobs

| Request | Admin | Manager | Developer | Auditor |
|:--------|:-----:|:-------:|:---------:|:-------:|
| GET /jobs | ✅ 200 | ❌ 403 | ✅ 200 | ❌ 403 |

> 💡 **Zero Trust observation:** Manager ranks above Developer for reports (Manager can write, Developer cannot), but Developer can execute jobs while Manager cannot. Roles are not hierarchical — they grant specific, least-privilege permissions.

#### 🔍 Audit

| Request | Admin | Manager | Developer | Auditor |
|:--------|:-----:|:-------:|:---------:|:-------:|
| GET /audit | ✅ 200 | ❌ 403 | ❌ 403 | ✅ 200 |
| DELETE /audit | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |

> 🛡️ **Key Security Principle:** The **Auditor** can read audit logs but **cannot delete them**. If Auditors could delete logs, they could cover up their own activity. This is enforced at the API level regardless of the page-level role check.

### Step 5: Run the Attack Simulation folder

Open **"🚫 Attack Simulation"** and send each request. All should return 401 or 403:

| Request | Expected | Why |
|:--------|:---------|:----|
| No Token | 401 | No Authorization header |
| Invalid Token | 401 | JWT parse error |
| Expired Token | 401 | `exp` claim in 1970 |
| Auditor deletes audit | 403 | Missing `delete:audit` |
| Developer creates Admin user | 403 | Missing `write:users` |

---

## Strategy 2 — Okta OAuth 2.0 (Requires Lab 2 Complete)

Get a **real Okta access token** directly inside Postman without writing any code.

### Step 1: Open any protected request in Postman

For example, open **"GET /api/protected/me"** from the collection.

### Step 2: Click the Authorization tab

In the request panel, click **Authorization**.

### Step 3: Configure OAuth 2.0

Set **Auth Type** to `OAuth 2.0`. Then click **Get New Access Token** and fill in:

| Field | Value |
|:------|:------|
| **Token Name** | `Okta Admin Token` |
| **Grant Type** | `Authorization Code (With PKCE)` |
| **Callback URL** | `https://oauth.pstmn.io/v1/callback` ← Postman's built-in redirect |
| **Auth URL** | `https://dev-XXXXXX.okta.com/oauth2/default/v1/authorize` |
| **Access Token URL** | `https://dev-XXXXXX.okta.com/oauth2/default/v1/token` |
| **Client ID** | Your Okta `OKTA_CLIENT_ID` from `.env` |
| **Client Secret** | Your Okta `OKTA_CLIENT_SECRET` from `.env` |
| **Scope** | `openid profile email groups` |
| **Code Challenge Method** | `SHA-256` |
| **State** | Leave blank (Postman generates it) |
| **Client Authentication** | `Send as Basic Auth header` |

> ⚠️ **Important:** You must add Postman's callback URL to Okta first:
> 1. Go to Okta Admin → **Applications** → **AuthMatrix Lab**
> 2. Click **Edit** on the General Settings
> 3. Under **Sign-in redirect URIs**, click **Add URI**
> 4. Add: `https://oauth.pstmn.io/v1/callback`
> 5. Click **Save**

### Step 4: Get the token

Click **Get New Access Token**.

A browser popup opens to Okta's login page. Log in with your Okta credentials. Postman captures the callback and exchanges the code automatically.

You will see a **"Token received"** dialog showing:
- `access_token` — the RS256 JWT from Okta
- `id_token` — OIDC identity token
- Expiry

Click **Use Token**.

### Step 5: Send the request

Click **Send**. The request goes to the API server with `Authorization: Bearer <okta_access_token>`.

> ℹ️ **Note:** The Okta access token is an RS256 JWT. The API server's current `auth.ts` validates HS256 (local) tokens. For full Okta token validation directly by the API (without APIM in the middle), the `auth.ts` middleware needs JWKS mode — this is covered in **Lab 4** (APIM handles RS256 validation at the gateway).

### Step 6: Verify the token in Postman

In the **"Tests"** tab for any request, add:
```javascript
var token = pm.request.headers.get('Authorization').replace('Bearer ', '');
var payload = JSON.parse(atob(token.split('.')[1]));
console.log('Okta claims:', JSON.stringify(payload, null, 2));
console.log('Groups:', payload.groups);
```

Run the request. In the Postman **Console** (View → Console), you will see the Okta token's raw claims including `groups: ["Admin", "Everyone"]`.

---

## Strategy 3 — Microsoft Entra ID OAuth 2.0 (Requires Lab 3 Complete)

Same process as Okta but with Entra endpoints.

### Step 1: Add Postman callback URL to Entra

1. Go to **Azure Portal** → **App Registration** → **AuthMatrix Lab**
2. Click **Authentication** in the left sidebar
3. Under **Web → Redirect URIs**, click **Add URI**
4. Add: `https://oauth.pstmn.io/v1/callback`
5. Click **Save**

### Step 2: Configure OAuth 2.0 in Postman

Open any protected request → **Authorization** → Auth Type: `OAuth 2.0` → **Get New Access Token**:

| Field | Value |
|:------|:------|
| **Token Name** | `Entra Admin Token` |
| **Grant Type** | `Authorization Code (With PKCE)` |
| **Callback URL** | `https://oauth.pstmn.io/v1/callback` |
| **Auth URL** | `https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize` |
| **Access Token URL** | `https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token` |
| **Client ID** | Your `ENTRA_CLIENT_ID` from `.env` |
| **Client Secret** | Your `ENTRA_CLIENT_SECRET` from `.env` |
| **Scope** | `openid profile email api://YOUR_CLIENT_ID/.default` |
| **Code Challenge Method** | `SHA-256` |
| **Client Authentication** | `Send as Basic Auth header` |

Replace `YOUR_TENANT_ID` and `YOUR_CLIENT_ID` with your actual values.

### Step 3: Get the token

Click **Get New Access Token**. Microsoft's login page opens in a popup. Sign in. Postman captures the token.

### Step 4: Inspect the Entra token claims

In Postman Console (using the same test script as Okta):
```javascript
var token = pm.request.headers.get('Authorization').replace('Bearer ', '');
var payload = JSON.parse(atob(token.split('.')[1]));
console.log('Entra claims:', JSON.stringify(payload, null, 2));
console.log('Roles:', payload.roles);
```

You will see `roles: ["Admin"]` — the Entra App Role claim. Notice the difference from Okta: `roles` (Entra) vs `groups` (Okta).

---

## Switching Roles in Postman

### Local tokens: edit the `active_token` collection variable

Quick role switching without re-running mock-token requests:

1. Click the collection → **Variables** tab
2. Set `active_token` Current Value to one of:
   - `{{token_admin}}`
   - `{{token_manager}}`
   - `{{token_developer}}`
   - `{{token_auditor}}`

### Okta: different Okta users per role

Each Okta user must be in the correct Okta Group (Lab 2 — Step 10-11):
- For Manager role: log in with a user that's in the `Managers` group
- For Auditor role: log in with a user that's in the `Auditors` group
- Get a new token in Postman for each user

### Entra: change App Role assignment

Each Entra user must be assigned the correct App Role (Lab 3 — Step 12-13):
- Go to **Enterprise App** → **Users and groups**
- Edit the user's role assignment
- Get a new token in Postman (old token still has old roles until it expires)

---

## Reading API Responses

Every API response follows the same structure:

**Success (200/201):**
```json
{
  "message": "✅ Access granted to Reports (read:reports)",
  "reports": [...],
  "requestedBy": "Admin User"
}
```

**Forbidden (403):**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions. Required: write:reports. Your permissions: read:users, read:reports, execute:jobs"
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized",
  "message": "No token provided"
}
```

The 403 message explicitly tells you which permission is needed vs what your token has — useful for debugging role configuration issues.

---

## ✅ Lab 5 Checklist

- [ ] Postman collection imported
- [ ] API server running on port 4000
- [ ] Ran all 4 mock-token requests — collection variables populated
- [ ] Tested GET /reports as each of the 4 roles
- [ ] Confirmed Developer gets 403 on POST /reports
- [ ] Confirmed Auditor gets 403 on DELETE /audit
- [ ] Confirmed Manager gets 403 on GET /jobs (even though Manager > Developer on reports)
- [ ] Ran all Attack Simulation requests — all returned 401 or 403
- [ ] (Optional) Configured Okta OAuth 2.0 in Postman and got real RS256 token
- [ ] (Optional) Compared Okta `groups` claim vs Entra `roles` claim in Postman Console

**Next:** [Lab 4 — Azure APIM API Gateway](../lab-04-azure-apim/README.md) (put APIM in front of all these endpoints)
