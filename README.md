# ⚡ AuthMatrix: Enterprise Identity & Access Management Masterclass

> A hands-on, practical repository for learning, exercising, and building enterprise identity management (IAM / IDM) systems from introductory concepts to advanced architecture. Powered by **[Astro](https://astro.build/)** for modern web applications & SSR middleware.

Designed for **Application Developers**, **Security Engineers**, **Security Architects**, and **Identity Managers**.

---

## 🎯 Target Audience & Learning Pathways

* **👨‍💻 Application Developers:** Learn how to integrate OIDC & SAML SSO into **Astro**, build **Astro Middleware (`src/middleware.ts`)** for RBAC route guards, handle OAuth 2.0 PKCE flows, decode & validate JWTs, and protect APIs.
* **🛡️ Security Engineers:** Learn how to audit JWT signatures, dynamic JWKS caching, validate scopes/claims, inspect SAML XML assertions, and defend against token attacks.
* **🏗️ Security Architects:** Understand enterprise IdP topologies, multi-IdP federation (Okta + Entra ID), zero-trust access control, Machine-to-Machine (M2M) authorization, and SCIM provisioning.
* **📋 Identity Managers & Admins:** Gain practical knowledge of App Registrations, Enterprise Applications, SAML ACS/Entity IDs, directory group mapping, and lifecycle management.

---

## 🗺️ Curriculum & Practical Sessions

| Phase | Title | Core Concepts | Hand-on Artifacts |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Environment & Setup** | Okta Preview & Microsoft Entra ID setup, local HTTPS, environment secrets. | [`docs/00-tenant-setup-guide.md`](docs/00-tenant-setup-guide.md) |
| **Phase 1** | **Foundations & Astro RBAC** | AuthN vs AuthZ, Session vs Token, RBAC matrix, Asymmetric Keys (RSA/JWK), Astro Middleware route guards. | [`docs/01-auth-foundations.md`](docs/01-auth-foundations.md) + Astro Sandbox App |
| **Phase 2** | **OIDC & OAuth 2.0** | Auth Code + PKCE, `id_token`, `access_token`, `refresh_token`, Okta & Entra OIDC in Astro. | [`docs/02-oidc-oauth2-guide.md`](docs/02-oidc-oauth2-guide.md) + OIDC Auth Flows |
| **Phase 3** | **SAML 2.0 Enterprise SSO** | SP vs IdP Initiated SSO, ACS URL, Entity ID, XML Signature & Assertion Parsing in Astro Endpoints. | [`docs/03-saml2-guide.md`](docs/03-saml2-guide.md) + SAML SP App |
| **Phase 4** | **API Security & JWT Validation** | Resource Server pattern, Bearer tokens, dynamic JWKS, claim validation, M2M OAuth. | [`docs/04-api-token-validation.md`](docs/04-api-token-validation.md) + Secured API Server |
| **Phase 5** | **Advanced IAM (SCIM & Policy)** | SCIM 2.0 user provisioning (`/scim/v2`), Multi-IdP federation, Policy Engine (OPA/ABAC). | [`docs/05-scim-and-advanced-iam.md`](docs/05-scim-and-advanced-iam.md) + SCIM Server |
| **Phase 6** | **Audit & Threat Modeling** | SIEM Auth Logs, JWT attack vectors (`alg: none`, key confusion), SAML XSW attacks. | [`docs/06-threat-modeling-and-audit.md`](docs/06-threat-modeling-and-audit.md) + Security Labs |

---

## 🛠️ Key Technologies & Identity Providers (IdPs)

* **Web Platform:** [Astro.build](https://astro.build/) (SSR mode, TypeScript, Astro Middleware, Server API Endpoints).
* **Okta Developer Preview:** OIDC Web Apps, OAuth 2.0 API Authorization Servers, SAML 2.0 Apps, SCIM Provisioning.
* **Microsoft Entra ID (Azure AD):** App Registrations, Enterprise SAML Applications, Graph API integration, Directory Group Claims.

---

## 🚀 Getting Started

1. Read the **[Tenant Setup Guide](docs/00-tenant-setup-guide.md)** to configure your free Okta and Microsoft Entra ID developer accounts.
2. Copy `.env.example` to `.env` and fill in your tenant domain and client keys:
   ```bash
   cp .env.example .env
   ```
3. Follow the phase-by-phase sessions in `docs/` and run the accompanying code in `apps/` and `labs/`.

---

## 📜 License

MIT License - Open for personal learning, corporate training, and community contributions.
