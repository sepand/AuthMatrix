# 📋 Phase 0: Tenant Setup & Official Identity Provider (IdP) Reference Guide

Welcome to Phase 0 of **AuthMatrix**. This guide provides step-by-step setup instructions and official reference documentation for configuring **Okta Developer Preview** and **Microsoft Entra ID (Azure AD)**.

---

## 📚 Official Identity Platform Documentation References

| Platform | Core Topic | Official Documentation Link |
| :--- | :--- | :--- |
| **Okta Developer** | OIDC & OAuth 2.0 Overview | [Okta OIDC & OAuth 2.0 API Docs](https://developer.okta.com/docs/concepts/oauth-oidc/) |
| **Okta Developer** | Authorization Servers | [Okta Custom Authorization Servers](https://developer.okta.com/docs/concepts/auth-servers/) |
| **Okta Developer** | SAML 2.0 Web Apps | [Okta SAML Application Setup Guide](https://developer.okta.com/docs/guides/build-sso-integration/saml2/overview/) |
| **Microsoft Entra** | App Registrations & OIDC | [Microsoft Entra ID App Registration Overview](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) |
| **Microsoft Entra** | OAuth 2.0 Auth Code Flow | [Microsoft Entra Auth Code Flow & PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) |
| **Microsoft Entra** | Enterprise SAML Apps | [Microsoft Entra Single Sign-On (SAML)](https://learn.microsoft.com/en-us/entra/identity-platform/single-sign-on-saml-protocol) |

---

## 1. Okta Developer Tenant Setup & Configuration

### A. Register Developer Org
1. Navigate to [developer.okta.com/signup](https://developer.okta.com/signup/) and complete registration.
2. Log into your Okta Admin Console (`https://dev-XXXXXX.okta.com/admin/dashboard`).

### B. Configure OIDC Web Application
1. Go to **Applications** $\rightarrow$ **Applications** $\rightarrow$ Click **Create App Integration**.
2. Select **OIDC - OpenID Connect** $\rightarrow$ Application Type: **Web Application**.
3. **Settings:**
   * **App integration name:** `AuthMatrix OIDC App`
   * **Grant Type:** Check `Authorization Code` and `Refresh Token`.
   * **Sign-in redirect URIs:** `http://localhost:3000/authorization-code/callback`
   * **Sign-out redirect URIs:** `http://localhost:3000`
   * **Assignments:** `Allow everyone in your organization to access`
4. Copy your **Client ID** and **Client Secret** into your `.env` file (`OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`).

### C. Configure SAML 2.0 Application
1. Go to **Applications** $\rightarrow$ **Applications** $\rightarrow$ Click **Create App Integration**.
2. Select **SAML 2.0** $\rightarrow$ App Name: `AuthMatrix SAML App`.
3. **General SAML Settings:**
   * **Single Sign-On URL (ACS):** `http://localhost:3000/saml/acs`
   * **Audience URI (SP Entity ID):** `https://authmatrix-sp.local`
   * **Name ID format:** `EmailAddress`
   * **Application username:** `Email`
4. **Attribute Statements (Claims Mapping):**
   | Name | Format | Value |
   | :--- | :--- | :--- |
   | `email` | Unspecified | `user.email` |
   | `firstName` | Unspecified | `user.firstName` |
   | `lastName` | Unspecified | `user.lastName` |
   | `groups` | Unspecified | Matches regex `.*` |

---

## 2. Microsoft Entra ID (Azure AD) Setup & Configuration

### A. Access Entra Admin Center
1. Navigate to [entra.microsoft.com](https://entra.microsoft.com/).
2. Select **Identity** from the left navigation panel.

### B. Register OIDC Web Application
1. Go to **Applications** $\rightarrow$ **App registrations** $\rightarrow$ Click **New registration**.
2. **Settings:**
   * **Name:** `AuthMatrix Entra App`
   * **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   * **Redirect URI:** Web $\rightarrow$ `http://localhost:3000/auth/entra/callback`
3. Click **Register**.
4. Copy **Application (client) ID** and **Directory (tenant) ID** into `.env`.
5. Under **Certificates & secrets** $\rightarrow$ Click **New client secret** $\rightarrow$ Copy Secret Value into `ENTRA_CLIENT_SECRET`.

### C. Configure Token Group Claims for RBAC
1. In your App Registration, navigate to **Token configuration** $\rightarrow$ Click **Add groups claim**.
2. Select `Security groups` and `Directory roles`.
3. Select `ID` or `NetBIOS Domain\Group Name`.
4. This ensures Entra ID includes user group memberships inside `access_token` and `id_token` for authorization checks!

---

## 3. Environment Variables Reference Table

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `OKTA_ORG_URL` | Your Okta Organization domain | `https://dev-123456.okta.com` |
| `OKTA_ISSUER` | Default Authorization Server Issuer | `https://dev-123456.okta.com/oauth2/default` |
| `OKTA_CLIENT_ID` | OIDC Client ID from Okta | `0oaxxxxxxxxxx357` |
| `ENTRA_TENANT_ID` | Microsoft Azure Directory Tenant ID | `a1b2c3d4-e5f6-7890-abcd-1234567890ab` |
| `ENTRA_CLIENT_ID` | Application Registration Client ID | `f8765432-10ab-cdef-0123-456789abcdef` |
