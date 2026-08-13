# Lab 4 — API Gateway: Azure APIM with Dual-IdP JWT Validation

> 🛡️ **Zero Trust Principle:** Assume Breach — the API Gateway is the single enforcement perimeter. It validates every token cryptographically, normalizes claims from both Okta and Entra into a common header schema, and backends never see raw IdP tokens.

**Duration:** ~90 minutes  
**Prerequisites:** 
- Lab 1 complete (local RBAC working)
- Lab 2 and/or Lab 3 complete (at least one real IdP configured)
- Azure subscription with access to create APIM resources
- Azure CLI installed: `winget install Microsoft.AzureCLI` or download from aka.ms/installazurecliwindows

**This lab is IdP-agnostic** — the same APIM policy handles both Okta tokens and Entra tokens. This is the only lab where the two IdPs converge.

---

## Architecture: What You Will Build

```
Your App (localhost:3000)
    │
    │  Bearer JWT from Okta OR Entra
    │
    ▼
Azure API Management (cloud)
    │
    ├─ 1. Strip X-User-* headers (prevent spoofing)
    ├─ 2. Detect issuer (Okta or Entra)
    ├─ 3a. Validate Okta JWT via Okta JWKS
    │      Map groups[] → X-App-Roles
    ├─ 3b. Validate Entra JWT via Entra JWKS
    │      Map roles[] → X-App-Roles
    ├─ 4. Inject: X-User-Id, X-User-Email, X-App-Roles, X-Idp-Source
    └─ 5. DELETE Authorization header
    │
    ▼
Express API Server (localhost:4000)
    Reads only X-App-Roles — never sees raw token
```

---

## Part A — Create Azure APIM Instance

### Step 1: Log in to Azure Portal

Go to: **https://portal.azure.com**

### Step 2: Create a Resource Group (if needed)

1. In the top search bar, type **Resource groups**
2. Click **+ Create**
3. Fill in:
   - **Subscription:** Your subscription
   - **Resource group name:** `authmatrix-lab-rg`
   - **Region:** Choose closest to you (e.g., East US)
4. Click **Review + create** → **Create**

### Step 3: Search for API Management

1. In the top search bar, type **API Management**
2. Click **API Management services**
3. Click **+ Create**

### Step 4: Fill in the APIM creation form

| Field | Value |
|:------|:------|
| **Subscription** | Your subscription |
| **Resource group** | `authmatrix-lab-rg` |
| **Region** | Same as your resource group |
| **Resource name** | `authmatrix-apim` (must be globally unique — add your initials if taken) |
| **Organization name** | `AuthMatrix Lab` |
| **Administrator email** | Your email |
| **Pricing tier** | **Developer** (no SLA, ~$50/month — use Consumption tier if preferred, it's cheaper) |

> ⚠️ **Cost warning:** Developer tier costs approximately $50/month. Use the **Consumption** tier for a pay-per-call model that's cheaper for labs. For Consumption tier: there is no VNet integration but it works fine for this lab.

Click **Review + create** → **Create**.

> ⏳ **Provisioning takes 30–45 minutes** for the Developer tier. Consumption tier deploys in ~2 minutes. Continue reading the lab while you wait.

### Step 5: Wait for deployment to complete

When you get the notification **"Deployment succeeded"**, click **Go to resource**.

Note your APIM **Gateway URL** from the Overview page:
```
https://authmatrix-apim.azure-api.net
```

---

## Part B — Create the API Definition in APIM

### Step 6: Create a new API

1. In your APIM instance left sidebar, click **APIs**
2. Click **+ Add API**
3. Select **HTTP** (manual definition)
4. Fill in:

| Field | Value |
|:------|:------|
| **Display name** | `AuthMatrix Resource Server` |
| **Name** | `authmatrix-api` |
| **Web service URL** | `http://host.docker.internal:4000` — see note below |
| **API URL suffix** | `api` |

> 📌 **Backend URL Note:** APIM needs to reach your local Express API server. For Consumption tier with no VNet, you have two options:
> - **Option A (Recommended for lab):** Use `ngrok` to expose port 4000 publicly — see Step 6b below
> - **Option B:** Deploy the API server to Azure App Service

**Step 6b (if using ngrok):** In a new terminal:
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 4000
```
Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok-free.app`) and use that as the Web service URL instead.

Click **Create**.

### Step 7: Add API operations

Click **+ Add operation** for each endpoint:

| Operation | Method | URL Template | Display Name |
|:----------|:-------|:-------------|:-------------|
| 1 | GET | `/protected/me` | Get My Identity |
| 2 | GET | `/protected/reports` | Get Reports |
| 3 | POST | `/protected/reports` | Create Report |
| 4 | GET | `/protected/users` | List Users |
| 5 | POST | `/protected/users` | Create User |
| 6 | GET | `/protected/audit` | Get Audit Log |
| 7 | DELETE | `/protected/audit` | Purge Audit Log |
| 8 | PUT | `/protected/settings` | Update Settings |

For each: fill in **Display name** and **URL**, then click **Save**.

---

## Part C — Apply the Dual-IdP Inbound Policy

This is the core of the lab. The APIM inbound policy validates JWTs from both Okta and Entra, normalizes their different claim formats, and injects standardized headers.

### Step 8: Open the All Operations policy editor

1. In your API, click **All operations** in the left list
2. Click the **Policies** tab (or `</>` icon)
3. Click **Policy code editor** (the `</>` button in the top right of the policy panel)

You will see a default policy XML. Replace the entire content with the following:

### Step 9: Paste the dual-IdP policy

Open the file at `config/azure-apim-policy.xml` in this repo. It contains the complete policy. Paste its full content into the APIM policy editor.

**Key sections explained:**

```xml
<!-- STEP 1: Strip spoofable headers (Zero Trust: Assume Breach) -->
<set-header name="X-User-Id"    exists-action="delete" />
<set-header name="X-App-Roles"  exists-action="delete" />
```
> Without this, an attacker could inject `X-App-Roles: Admin` directly and bypass all authorization.

```xml
<!-- STEP 2: Detect which IdP issued the token -->
<set-variable name="tokenIssuer"
    value="@(context.Request.Headers
              .GetValueOrDefault("Authorization","")
              .AsJwt()?.Issuer ?? "")" />
```
> We peek at the `iss` claim before full validation to route to the correct JWKS validator.

```xml
<!-- STEP 3A: Full RS256 validation against Okta JWKS -->
<validate-jwt header-name="Authorization" ...>
    <openid-config url="https://dev-XXXXX.okta.com/oauth2/default
                        /.well-known/openid-configuration" />
```
> APIM fetches and caches Okta's public keys. Any token with a mismatched signature returns 401 immediately.

```xml
<!-- Okta group → role normalization -->
var roleMap = new Dictionary<string,string> {
    { "Admin",    "Admin" },
    { "Managers", "Manager" },
    { "Developers", "Developer" },
    { "Auditors", "Auditor" }
};
```
> Okta group names are mapped to our internal vocabulary. This is the ONLY place where this mapping lives — backend code never needs to know about Okta group names.

```xml
<!-- Entra: roles[] already matches internal vocabulary — passthrough -->
var roles = jwt?.Claims.GetValueOrDefault("roles", new string[0]);
return string.Join(",", roles);
```
> Entra App Roles are already named `Admin`, `Manager`, etc. — no transformation needed.

```xml
<!-- STEP 5: Inject normalized headers, DELETE raw token -->
<set-header name="X-App-Roles" exists-action="override">
    <value>@((string)context.Variables["normalizedRoles"])</value>
</set-header>
<set-header name="Authorization" exists-action="delete" />
```
> After injecting verified headers, the raw Authorization Bearer token is removed. Backend receives `X-App-Roles: Admin` but never the JWT.

### Step 10: Customize the policy for your tenants

In the policy XML, replace these placeholder values:

| Placeholder | Replace with | Where to find it |
|:------------|:-------------|:----------------|
| `dev-YOUR_OKTA_ORG.okta.com` | Your Okta domain | Okta Admin Console top-right |
| `https://api.authmatrix.local` | Your Okta API audience | Okta → Security → API → Auth Server Settings |
| `YOUR_TENANT_ID` (Entra) | Your Azure Tenant ID | Azure Portal → Entra ID → Overview |
| `api://authmatrix-app-client-id` | Your Entra Application ID URI | Azure → App Registration → Expose an API |

After editing, click **Save**.

---

## Part D — Update the Express API to Trust Gateway Headers

Currently, the API server (`apps/api-server/src/middleware/auth.ts`) validates the JWT signature directly. When traffic comes through APIM, the raw token is stripped — the API receives headers instead.

### Step 11: Add gateway header mode to the auth middleware

The existing `auth.ts` supports both modes. You need to add an endpoint that reads from gateway headers.

Add this new endpoint to `apps/api-server/src/index.ts`:

```typescript
// ── APIM GATEWAY MODE: Read pre-validated headers from APIM ──────────────────
// This endpoint trusts X-App-Roles injected by the APIM gateway.
// NEVER expose this endpoint directly to the internet — only via APIM.
app.get('/api/gateway/me', (req, res) => {
  // Zero Trust: These headers were set by APIM after JWT validation.
  // The backend trusts them because direct access is blocked by APIM VNet / IP allowlist.
  const userId  = req.headers['x-user-id'];
  const email   = req.headers['x-user-email'];
  const roles   = (req.headers['x-app-roles'] as string || '').split(',').filter(Boolean);
  const idpSrc  = req.headers['x-idp-source'];

  if (!userId) {
    return res.status(401).json({ error: 'Missing X-User-Id header — request must come via APIM' });
  }

  res.json({
    message:  '✅ Identity verified via Azure APIM gateway',
    identity: { userId, email, roles, idpSource: idpSrc },
    note:     'JWT was validated at the APIM edge. This backend never saw the raw token.',
  });
});
```

### Step 12: Restart the API server

```bash
# Stop with Ctrl+C then:
npm run dev --workspace=apps/api-server
```

---

## Part E — Test the APIM Gateway Flow

### Step 13: Get a real token from your IdP

**Option A — Get an Okta token:**
1. Use the AuthMatrix dashboard — sign in with Okta (Lab 2)
2. In the JWT Inspector on the dashboard, the **RAW TOKEN** shown is your normalized session token
3. To get the actual Okta access token: temporarily log it in `okta-callback.ts`:
   ```typescript
   console.log('Okta access_token:', tokens.access_token);
   ```
   Restart the server, sign in, copy the token from the terminal.

**Option B — Get an Entra token:**
Same approach via `entra-callback.ts`.

> 💡 For testing APIM, you need the **IdP-issued access token** (RS256), not the normalized session token (HS256). The IdP token is what gets sent to APIM.

### Step 14: Test APIM using curl

Replace `YOUR_TOKEN` with the access token from Step 13 and replace `authmatrix-apim` with your APIM name:

```bash
# Test via APIM gateway
curl -H "Authorization: Bearer YOUR_OKTA_OR_ENTRA_TOKEN" \
     https://authmatrix-apim.azure-api.net/api/protected/me
```

**Expected Response (via APIM → Express API):**
```json
{
  "message": "✅ Authenticated — here are your identity claims",
  "userClaims": { ... }
}
```

**Expected APIM-added headers on the backend (check your API server logs):**
```
X-User-Id: your-user-id
X-User-Email: your@email.com
X-App-Roles: Admin
X-Idp-Source: okta
```

### Step 15: Test Okta token then Entra token through the SAME APIM gateway

1. Get an Okta access token → send to APIM → observe `X-Idp-Source: okta` and `X-App-Roles: Admin`
2. Get an Entra access token → send to APIM → observe `X-Idp-Source: entra` and `X-App-Roles: Admin`

**The backend API receives identical `X-App-Roles: Admin` regardless of which IdP authenticated the user. The backend is fully IdP-agnostic.**

### Step 16: Test unauthorized access

```bash
# No token — should get 401 from APIM (never reaches backend)
curl https://authmatrix-apim.azure-api.net/api/protected/me

# Tampered token — should get 401 from APIM
curl -H "Authorization: Bearer invalid.token.here" \
     https://authmatrix-apim.azure-api.net/api/protected/me

# Try header injection — APIM strips it before backend
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-App-Roles: Admin" \
     https://authmatrix-apim.azure-api.net/api/protected/me
# Result: X-App-Roles is stripped and re-injected from the token — injection ignored ✅
```

---

## Part F — APIM Policy Debugging

### Step 17: Enable APIM tracing

1. In the Azure Portal → your APIM → **APIs** → **AuthMatrix Resource Server**
2. Click **Test** tab
3. Select **GET /protected/me** operation
4. In the **Headers** section, add:
   - Name: `Authorization`
   - Value: `Bearer YOUR_TOKEN`
5. Click **Trace** (not just Send)

The trace output shows every policy step:
```
Step 1: set-header X-User-Id (delete) — ✅ executed
Step 2: tokenIssuer = "https://dev-XXXXX.okta.com/oauth2/default"
Step 3a: validate-jwt — ✅ signature valid
Step 4: normalizedRoles = "Admin"
Step 5: X-App-Roles header set to "Admin"
Step 6: Authorization header deleted
→ Backend request sent without Authorization header ✅
```

---

## ✅ Lab 4 Complete — Validation Checklist

- [ ] APIM instance created and deployed
- [ ] API operations defined for all AuthMatrix endpoints
- [ ] Dual-IdP policy XML applied from `config/azure-apim-policy.xml`
- [ ] Policy customized with your Okta domain and Entra Tenant ID
- [ ] Express API server reachable from APIM (via ngrok or App Service)
- [ ] Okta token sent through APIM → 200 response, `X-Idp-Source: okta`
- [ ] Entra token sent through APIM → 200 response, `X-Idp-Source: entra`
- [ ] Both tokens produce identical `X-App-Roles: Admin` on the backend
- [ ] Tampered token → 401 from APIM (never reaches backend)
- [ ] Header injection attempt → APIM strips `X-App-Roles` before backend

---

## Key Takeaways

| Scenario | What APIM Does | What Backend Gets |
|:---------|:---------------|:------------------|
| Valid Okta token, Admin group | Validates RS256, maps groups[] | `X-App-Roles: Admin` |
| Valid Entra token, Admin role | Validates RS256, passes roles[] | `X-App-Roles: Admin` |
| No token | Returns 401 immediately | Nothing — request blocked |
| Tampered token | Returns 401 (signature invalid) | Nothing — request blocked |
| Injected X-App-Roles header | Strips it, re-injects from token | Gateway-verified value only |
| Expired token | Returns 401 (exp check fails) | Nothing — request blocked |

**Next:** [Lab 5 — JWT Validation Deep Dive](../lab-05-jwt-validation/README.md)
