# ⚡ AuthMatrix: Enterprise Identity & Access Management Masterclass

> A hands-on, practical sandbox for learning, building, and validating enterprise identity management systems — from RBAC fundamentals to real IdP integration, API gateway security, and Zero Trust architecture.

Built on **[Astro SSR](https://astro.build/)** · **Express API Server** · **Okta** · **Microsoft Entra ID** · **Azure APIM**

Designed for **Application Developers**, **Security Engineers**, **Security Architects**, and **Identity Managers**.

---

## 🛡️ Zero Trust Foundation

Every phase of AuthMatrix is grounded in the **Zero Trust Security Model**:

| Principle | How It's Applied |
|:----------|:----------------|
| **Verify Explicitly** | Every API call validates a signed JWT — no session trust, no IP trust |
| **Least Privilege** | Every route and endpoint declares the minimum permission required |
| **Assume Breach** | API Gateway strips untrusted headers; backends never receive raw tokens |

→ Read the full framework: [`docs/00a-zero-trust-principles.md`](docs/00a-zero-trust-principles.md)

---

## 🏗️ Architecture

```
Browser
  │
  ├── Astro SSR Frontend (port 3000)
  │     ├── /login          — Mode A: Local Simulator | Mode B: Okta OIDC | Entra OIDC
  │     ├── /dashboard      — JWT Inspector · Identity Claims · API Tester
  │     ├── /dashboard/reports  — Manager, Developer, Admin
  │     ├── /dashboard/audit    — Auditor, Admin
  │     └── /dashboard/admin    — Admin only
  │
  └── Express Resource Server (port 4000)
        ├── GET  /api/public                 — No auth
        ├── GET  /api/protected/me           — Any authenticated user
        ├── GET  /api/protected/reports      — read:reports
        ├── POST /api/protected/reports      — write:reports
        ├── GET  /api/protected/users        — read:users
        ├── POST /api/protected/users        — write:users
        ├── DELETE /api/protected/users/:id  — delete:users
        ├── GET  /api/protected/jobs         — execute:jobs
        ├── GET  /api/protected/audit        — read:audit
        ├── DELETE /api/protected/audit      — delete:audit (Admin only)
        └── PUT  /api/protected/settings     — write:settings

Azure APIM (optional — Lab 4)
  └── Single gateway for BOTH Okta and Entra tokens
        → Validates JWT · Normalizes claims · Injects X-App-Roles header
```

---

## 🗺️ Curriculum & Labs

### 📚 Phase Documentation

| Phase | Title | Guide |
|:------|:------|:------|
| Phase 0 | Tenant Setup (Okta & Entra) | [`docs/00-tenant-setup-guide.md`](docs/00-tenant-setup-guide.md) |
| Phase 0a | Zero Trust Principles | [`docs/00a-zero-trust-principles.md`](docs/00a-zero-trust-principles.md) |
| Phase 1 | Auth Foundations & RBAC | [`docs/01-auth-foundations.md`](docs/01-auth-foundations.md) |
| Phase 2 | OIDC & OAuth 2.0 | [`docs/02-oidc-oauth2-guide.md`](docs/02-oidc-oauth2-guide.md) |
| Phase 3 | SAML 2.0 Enterprise SSO | [`docs/03-saml2-guide.md`](docs/03-saml2-guide.md) |
| Phase 4 | API Security & JWT Validation | [`docs/04-api-token-validation.md`](docs/04-api-token-validation.md) |
| Phase 5 | API Gateway Security | [`docs/05-api-gateway-security.md`](docs/05-api-gateway-security.md) |
| ADR | Identity Federation Architecture | [`docs/ADR-SEC-2026-001-identity-federation.md`](docs/ADR-SEC-2026-001-identity-federation.md) |

### 🧪 Hands-On Labs

Each lab is fully self-contained with step-by-step instructions, expected results, and validation checklists.

| Lab | Title | IdP | Duration |
|:----|:------|:----|:---------|
| **Lab 1** | [Local RBAC & JWT Fundamentals](labs/lab-01-local-rbac/README.md) | None (local) | ~30 min |
| **Lab 2** | [Okta OIDC Authentication](labs/lab-02-okta-oidc/README.md) | **Okta only** | ~45 min |
| **Lab 3** | [Microsoft Entra ID OIDC Authentication](labs/lab-03-entra-oidc/README.md) | **Entra only** | ~45 min |
| **Lab 4** | [Azure APIM API Gateway (Dual-IdP)](labs/lab-04-azure-apim/README.md) | Okta + Entra → APIM | ~90 min |
| **Lab 5** | [API Testing with Postman](labs/lab-05-postman-api-testing/README.md) | All (local + Okta + Entra) | ~30 min |

> **Labs 2 and 3 are completely independent** — complete either or both. They only converge in Lab 4, where Azure APIM acts as the single gateway for both IdPs.

---

## 🎭 Role & Permission Matrix

| Role | Assigned Permissions | Dashboard Pages |
|:-----|:--------------------|:----------------|
| **Admin** | All permissions | Dashboard · Reports · Audit · Admin Zone |
| **Manager** | `read:users` · `read:reports` · `write:reports` | Dashboard · Reports |
| **Developer** | `read:users` · `read:reports` · `execute:jobs` | Dashboard · Reports |
| **Auditor** | `read:audit` · `read:reports` | Dashboard · Audit |

**Okta:** Roles come from Okta Groups (`groups` claim) — mapped via gateway policy  
**Entra:** Roles come from Entra App Roles (`roles` claim) — already uses internal vocabulary

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- An Okta Developer account (free): [developer.okta.com/signup](https://developer.okta.com/signup/)
- A Microsoft Azure account (free tier): [portal.azure.com](https://portal.azure.com)

### 1. Clone and install

```bash
git clone https://github.com/sepand/AuthMatrix.git
cd AuthMatrix
npm install
```

### 2. Configure environment

```bash
copy .env.example .env
```

Open `.env` and fill in your credentials. For **Lab 1 (local only)**, no credentials are needed — the defaults work as-is.

### 3. Start both servers

**Terminal 1 — API Server:**
```bash
npm run dev --workspace=apps/api-server
# Starts at http://localhost:4000
```

**Terminal 2 — Astro Frontend:**
```bash
npm run dev --workspace=apps/astro-frontend
# Starts at http://localhost:3000
```

### 4. Open the app

Navigate to **http://localhost:3000**

- Click **👑 Login as Admin** to start Lab 1 immediately (no IdP setup needed)
- Follow [Lab 1](labs/lab-01-local-rbac/README.md) for a guided walkthrough

---

## 📁 Project Structure

```
AuthMatrix/
├── apps/
│   ├── astro-frontend/          # Astro SSR web application (port 3000)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── pkce.ts      # PKCE code_verifier/challenge generation
│   │       │   └── oidc.ts      # Token exchange, RS256 validation, session creation
│   │       ├── middleware.ts    # Route guards (RBAC enforcement)
│   │       └── pages/
│   │           ├── login.astro          # IdP chooser (Local / Okta / Entra)
│   │           ├── dashboard/
│   │           │   ├── index.astro      # JWT Inspector + API Tester
│   │           │   ├── reports.astro    # Manager/Developer/Admin
│   │           │   ├── audit.astro      # Auditor/Admin
│   │           │   └── admin.astro      # Admin only
│   │           └── api/auth/
│   │               ├── login.ts         # Local simulator token
│   │               ├── logout.ts        # Clear session
│   │               ├── okta-login.ts    # PKCE redirect to Okta
│   │               ├── okta-callback.ts # Okta code exchange + JWKS validation
│   │               ├── entra-login.ts   # PKCE redirect to Entra
│   │               └── entra-callback.ts# Entra code exchange + JWKS validation
│   │
│   └── api-server/              # Express Resource Server (port 4000)
│       └── src/
│           ├── index.ts         # All 10 protected endpoints
│           └── middleware/
│               ├── auth.ts      # JWT validation (HS256 local + RS256 JWKS)
│               └── gatewaySimulator.ts  # APIM header injection simulation
│
├── config/
│   ├── azure-apim-policy.xml   # Dual-IdP APIM inbound policy (Lab 4)
│   └── kong-declarative.yml    # Kong reference configuration
│
├── docs/                        # Phase guides & ADR
├── labs/                        # Step-by-step lab exercises
│   ├── lab-01-local-rbac/
│   ├── lab-02-okta-oidc/       # Okta only
│   ├── lab-03-entra-oidc/      # Entra only
│   └── lab-04-azure-apim/      # Dual-IdP convergence via APIM
│
├── .env.example                 # Environment template
└── AGENTS.md                    # Agent rules (supply-chain security policy)
```

---

## 🛡️ Supply Chain Security Policy

> **7-Day Package Age Requirement:** No npm package or library version may be installed if it was published within the last 7 days. This protects against supply chain attacks and malicious zero-day version pushes. See [`AGENTS.md`](AGENTS.md) and [`.agents/rules/supply-chain-security.md`](.agents/rules/supply-chain-security.md).

---

## 📜 License

MIT License — Open for personal learning, corporate training, and community contributions.
