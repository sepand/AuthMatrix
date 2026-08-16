# E2E Test Infra: AuthMatrix IAM Masterclass

## Test Philosophy
- Opaque-box, requirement-driven. Derives test assertions directly from `ORIGINAL_REQUEST.md`, RFC standards, and enterprise Zero Trust requirements.
- Uses Node.js v22 native test runner (`node:test` + `tsx`) with zero new dependencies, guaranteeing 100% compliance with the 7-day supply chain rule.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | Static Learn Site Astro Config | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Module 1: OAuth 2.0 (RFC 6749/9700) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Module 2: Grant Types & PKCE (RFC 7636/8628) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Module 3: OpenID Connect Core 1.0 | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Module 4: Tokens/JWT/JWKS (RFC 7519/7517/7662/7009) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Labs Hub & 5 Lab Guides | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 7 | GitHub Actions CI/CD Deployment | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 8 | Express API Server & Zero Trust RBAC | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 9 | Astro SSR Route Guard Middleware | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 10 | Multi-IdP Claim Normalization (Okta vs Entra) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 11 | Azure APIM Gateway Dual-IdP Policy | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Runner Invocation**:
  - Full test suite: `npm test` (`node --import tsx --test tests/**/*.test.ts`)
  - Unit tests: `npm run test:unit` (`node --import tsx --test tests/unit/**/*.test.ts`)
  - API integration tests: `npm run test:api` (`node --import tsx --test tests/api/**/*.test.ts`)
  - Static site validation: `npm run test:site` (`node --import tsx --test tests/site/**/*.test.ts`)
  - E2E flow tests: `npm run test:e2e` (`node --import tsx --test tests/e2e/**/*.test.ts`)
- **Directory Layout**:
  - `tests/unit/`: Pure function & logic tests (RBAC matrix, claim normalization, PKCE generator, APIM simulator)
  - `tests/api/`: Express API endpoints, 401/403 status codes, role permissions, mock token generation
  - `tests/site/`: Static site verification (`apps/learn-site/dist/`), 11 HTML pages, base `/AuthMatrix/` link verification, GitHub Actions workflow validation
  - `tests/e2e/`: End-to-end user workflows, login session handling, multi-role dashboard access, simulated token tampering

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Admin full management cycle (User creation, report generation, audit purge, settings change) | F8, F9, F10 | Medium |
| 2 | Auditor inspection with restricted write actions (Audit log read, report read, 403 on user delete/audit purge) | F8, F9 | Medium |
| 3 | Developer job execution & debugging (Execute jobs, read users, 403 on user creation/settings change) | F8, F9 | Medium |
| 4 | Manager reporting & review (Read users, write reports, read reports, 403 on user deletion/settings change) | F8, F9 | Medium |
| 5 | Okta vs Entra ID multi-IdP federation (Okta groups dictionary mapping vs Entra App Roles normalization) | F10, F11 | High |
| 6 | Token tampering & Zero Trust rejection (Modified signature, expired token, forged claims) | F8, F9 | High |
| 7 | Static Site GitHub Pages Navigation & RFC citation check | F1, F2, F3, F4, F5, F6, F7 | Medium |

## Coverage Thresholds
- Tier 1: >= 55 test cases across 11 features (>= 5 per feature)
- Tier 2: >= 55 test cases (boundary, edge cases, tamper detection, missing claims, invalid tokens)
- Tier 3: >= 11 cross-feature integration test cases
- Tier 4: >= 7 realistic end-to-end application scenarios
- **Total Minimum Test Count: >= 128 test cases**
