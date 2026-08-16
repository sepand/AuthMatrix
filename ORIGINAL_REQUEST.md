# Original User Request

## Initial Request — 2026-08-15T22:42:51-07:00

Build, polish, and verify the full AuthMatrix IAM Masterclass: a browsable static Astro learning site deployable to GitHub Pages containing comprehensive, RFC-accurate OAuth 2.0 / OIDC / JWT / API Gateway guides and lab walkthroughs, plus a local multi-role Zero Trust lab environment.

Working directory: `c:\GitHub\Learn IDM`
Integrity mode: development

## Requirements

### R1. Static Masterclass Learning Site (GitHub Pages)
- Standalone static Astro site at `apps/learn-site` configured with `base: '/AuthMatrix'` for `https://sepand.github.io/AuthMatrix/`.
- Contains 4 RFC-grounded, vendor-neutral conceptual modules:
  1. OAuth 2.0 Fundamentals (RFC 6749, RFC 9700)
  2. Grant Types & PKCE (RFC 7636, RFC 8628)
  3. OpenID Connect Core 1.0
  4. Tokens, JWT, JWKS, Introspection, Revocation (RFC 7519, RFC 7517, RFC 7662, RFC 7009)
- Includes 5 interactive lab guides (Local RBAC, Okta OIDC, Entra ID OIDC App Roles, Azure APIM Dual-IdP Gateway, and Postman testing).
- Automated GitHub Actions deployment workflow at `.github/workflows/deploy-learn-site.yml`.

### R2. Local Lab Environment & Multi-IdP Backend
- Astro SSR frontend and Express API server operating under Zero Trust mentality (Verify Explicitly, Least Privilege, Assume Breach).
- Supports distinct roles (Admin, Manager, Developer, Auditor) and per-IdP native role models (Entra App Roles vs Okta Groups claim).
- APIM gateway configuration for dual-IdP token validation and header normalization.

## Acceptance Criteria

### Static Site Build & Verification
- [ ] `npm run build:learn` completes with 0 errors and generates static HTML for all 11 pages in `apps/learn-site/dist`.
- [ ] All internal navigation and asset links correctly resolve under the `/AuthMatrix/` base path.
- [ ] GitHub Actions workflow file `.github/workflows/deploy-learn-site.yml` is valid and configured to deploy to GitHub Pages.

### Lab App Verification
- [ ] Role-based access control rules properly isolate endpoints per role specification.
- [ ] Token decoding and claim normalization logic operates consistently across mock, Okta, and Entra tokens.
