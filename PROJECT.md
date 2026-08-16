# Project: AuthMatrix IAM Masterclass

## Architecture
AuthMatrix is an enterprise IAM Masterclass monorepo with an educational static site, a local Zero Trust lab environment with Astro SSR and Express API, multi-IdP support (Okta & Entra ID), and an Azure APIM gateway configuration.

- **Monorepo Structure**: npm workspaces (`apps/*`) with root `package-lock.json`.
- **Static Masterclass Site (`apps/learn-site`)**: Static Astro 5 site (`output: 'static'`, `base: '/AuthMatrix'`) deployable to GitHub Pages at `https://sepand.github.io/AuthMatrix/`. Contains 11 static pages (Home, 4 RFC modules, 5 lab walkthroughs, and Labs Hub).
- **Astro SSR Frontend (`apps/astro-frontend`)**: Astro 5 SSR (`@astrojs/node` standalone adapter, port 3000) providing interactive lab UI, role simulator, OIDC login/callbacks (Okta & Entra ID), PKCE generation, session management, and route middleware protection.
- **Express Resource API Server (`apps/api-server`)**: Express 4.21 server (port 4000) with 10 REST endpoints enforcing granular permissions and RBAC scopes, supporting local mock tokens (HS256) and IdP tokens (RS256 via JWKS).
- **Gateway Security (`config/azure-apim-policy.xml`)**: Inbound XML policy enforcing header stripping, issuer detection, JWKS token validation, claim normalization (Okta `groups` dictionary mapping vs Entra `roles` mapping), and `Authorization` header deletion.
- **Test Infrastructure (`tests/`)**: Node 22 native test runner (`node --import tsx --test`) covering unit, API, static site, and end-to-end integration tests.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Static Learn Site Astro Config | Static build with base path `/AuthMatrix` for GitHub Pages | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Module 1: OAuth 2.0 Fundamentals | RFC 6749, RFC 9700 conceptual guide & security BCP | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Module 2: Grant Types & PKCE | RFC 7636, RFC 8628 flow comparisons & PKCE S256 | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Module 3: OpenID Connect Core 1.0 | OIDC Core 1.0 architecture, claims & discovery | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Module 4: Tokens, JWT & JWKS | RFC 7519, RFC 7517, RFC 7662, RFC 7009 token specifications | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Labs Hub & 5 Lab Walkthroughs | 5 interactive lab guides synced with labs/ markdown | M1 | ORIGINAL_REQUEST §R1 |
| 7 | Static Site Favicon & Navigation | Favicon asset and clean `/AuthMatrix/` link routing | M1 | Survey (spec_miner) |
| 8 | GitHub Actions CI/CD Workflow | `.github/workflows/deploy-learn-site.yml` for Pages deployment | M1 | ORIGINAL_REQUEST §R1 |
| 9 | Express API Server TS Fixes & Endpoints | Express 5 params typing fix and 10 protected endpoints | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Zero Trust RBAC API Protection | Permission matrix & role isolation across 4 roles | M2 | ORIGINAL_REQUEST §R2 |
| 11 | API Token Validation & Gateway Sim | HS256 mock + RS256 JWKS validation & gateway headers | M2 | ORIGINAL_REQUEST §R2 |
| 12 | Astro SSR Template Fixes & Route Guards | Zero Trust route middleware protecting dashboard routes | M3 | ORIGINAL_REQUEST §R2 |
| 13 | Multi-IdP Claim Normalization | Okta `groups` vs Entra `roles` claim normalization | M3 | ORIGINAL_REQUEST §R2 |
| 14 | PKCE & OIDC Token Exchange | Secure authorization code exchange with S256 PKCE | M3 | ORIGINAL_REQUEST §R2 |
| 15 | APIM Dual-IdP Gateway Policy | Azure APIM XML policy for dual-IdP normalization | M3 | ORIGINAL_REQUEST §R2 |
| 16 | E2E Testing Suite (Tiers 1-4) | Comprehensive requirement-driven opaque-box test suite | M4 | ORIGINAL_REQUEST Acceptance |
| 17 | Adversarial Hardening (Tier 5) | White-box stress-testing and security edge case coverage | M4 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Static Learn Site & CI/CD | `apps/learn-site`, favicon, diagrams, `.github/workflows/deploy-learn-site.yml` | none | DONE |
| M2 | Backend API Server & RBAC | `apps/api-server`, TS fix, 10 endpoints, RBAC permissions, token verification | none | DONE |
| M3 | Frontend SSR & Claim Normalization | `apps/astro-frontend`, template syntax fix, route guards, OIDC normalization | M2 | DONE |
| M4 | E2E Testing & Adversarial Hardening | E2E test suite (Tiers 1-4) pass 100% + Tier 5 adversarial hardening | M1, M2, M3 | DONE |

## Interface Contracts
### Astro Frontend $\leftrightarrow$ Express API Server
- **Authentication**: `Authorization: Bearer <JWT>` where JWT is signed with `LOCAL_MOCK_SECRET` (HS256) or IdP private key (RS256).
- **JWT Payload Claims**:
  ```json
  {
    "sub": "user_id",
    "email": "user@authmatrix.local",
    "roles": ["Admin" | "Manager" | "Developer" | "Auditor"],
    "permissions": ["read:reports", "write:users", ...],
    "iss": "https://authmatrix.local",
    "exp": 1755300000
  }
  ```
- **Error Responses**: HTTP 401 Unauthorized (`{ "error": "Unauthorized", "message": "..." }`), HTTP 403 Forbidden (`{ "error": "Forbidden", "requiredPermission": "..." }`).

### APIM Gateway $\leftrightarrow$ Downstream Microservices
- **Stripped Headers**: All inbound `X-User-*` and `Authorization` headers deleted.
- **Injected Headers**:
  - `X-User-Id`: Subject ID
  - `X-User-Email`: User email
  - `X-App-Roles`: Comma-separated list of normalized roles (`Admin,Manager,Developer,Auditor`)
  - `X-Idp-Source`: `okta` or `entra`
  - `X-Token-Exp`: Unix epoch expiration timestamp

## Code Layout
- `apps/learn-site/`: Static Astro site for GitHub Pages (`src/pages/`, `src/layouts/`, `public/`)
- `apps/astro-frontend/`: Astro SSR lab app (`src/pages/`, `src/middleware.ts`, `src/lib/`)
- `apps/api-server/`: Express resource server (`src/index.ts`, `src/middleware/auth.ts`, `src/middleware/gatewaySimulator.ts`)
- `config/`: Gateway policies (`azure-apim-policy.xml`, `kong-declarative.yml`)
- `labs/`: Markdown lab manuals (`lab-01` through `lab-05`)
- `.github/workflows/`: GitHub Actions workflows (`deploy-learn-site.yml`)
- `tests/`: Automated test suite (`unit/`, `api/`, `site/`, `e2e/`)
