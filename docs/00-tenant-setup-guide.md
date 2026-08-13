# 📋 Phase 0: Identity Provider (IdP) Setup Guide

This guide will walk you through setting up free developer instances of **Okta Preview** and **Microsoft Entra ID (Azure AD)** so you can practice hands-on enterprise authentication and authorization flows.

---

## 1. Okta Developer Tenant Setup

1. **Sign Up for a Free Okta Developer Account:**
   - Go to [developer.okta.com/signup](https://developer.okta.com/signup/)
   - Register for an account. Okta will provision a developer org URL such as `https://dev-XXXXXX.okta.com`.
   - Log into your Okta Admin Console.

2. **Create an OIDC Web Application (For Phase 2 & Phase 4):**
   - In Okta Admin Console, navigate to **Applications** $\rightarrow$ **Applications**.
   - Click **Create App Integration**.
   - Choose **OIDC - OpenID Connect**.
   - Application Type: **Web Application**. Click **Next**.
   - Set **App integration name**: `Learn IDM OIDC App`.
   - **Grant Type:** Check `Authorization Code` and `Refresh Token`.
   - **Sign-in redirect URIs:** `http://localhost:3000/authorization-code/callback` (or your chosen local URL).
   - **Sign-out redirect URIs:** `http://localhost:3000`.
   - **Assignments:** Select `Allow everyone in your organization to access`.
   - Click **Save**.
   - Copy your **Client ID** and **Client Secret** into your `.env` file (`OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`).

3. **Create a SAML 2.0 Web Application (For Phase 3):**
   - In Applications $\rightarrow$ Applications, click **Create App Integration**.
   - Choose **SAML 2.0**. Click **Next**.
   - App Name: `Learn IDM SAML App`. Click **Next**.
   - **Single Sign-On URL (ACS):** `http://localhost:3000/saml/acs`.
   - **Audience URI (SP Entity ID):** `https://learn-idm-sp.local`.
   - **Attribute Statements (Claims Mapping):**
     | Name | Format | Value |
     | :--- | :--- | :--- |
     | `email` | Unspecified | `user.email` |
     | `firstName` | Unspecified | `user.firstName` |
     | `lastName` | Unspecified | `user.lastName` |
     | `groups` | Unspecified | Matches regex `.*` |
   - Click **Next** $\rightarrow$ Select **I'm an Okta customer adding an internal app** $\rightarrow$ **Finish**.
   - On the **Sign On** tab, copy the **Metadata URL** or download the **SAML Setup Instructions** (Issuer URL, SSO URL, X.509 Certificate).

---

## 2. Microsoft Entra ID (Azure AD) Setup

1. **Access Microsoft Entra Admin Center:**
   - Go to [entra.microsoft.com](https://entra.microsoft.com/)
   - If you have an M365 Developer Plan or Azure account, sign in with your admin credentials.

2. **Register an OIDC Application (App Registration):**
   - Navigate to **Identity** $\rightarrow$ **Applications** $\rightarrow$ **App registrations**.
   - Click **New registration**.
   - Name: `Learn IDM Entra App`.
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`.
   - **Redirect URI:** Select `Web` and enter `http://localhost:3000/auth/entra/callback`.
   - Click **Register**.
   - Copy **Application (client) ID** and **Directory (tenant) ID** into `.env`.
   - Under **Certificates & secrets** $\rightarrow$ Click **New client secret** $\rightarrow$ Add description $\rightarrow$ Copy the Secret Value immediately into `ENTRA_CLIENT_SECRET`.
   - Under **API permissions**, ensure `openid`, `profile`, `email`, and `User.Read` are granted.

3. **Configure Directory Groups & Optional Claims:**
   - Navigate to **Token configuration** $\rightarrow$ Click **Add groups claim**.
   - Select `Security groups` and `Directory roles` $\rightarrow$ Select `ID` or `NetBIOS Domain\Group Name`.
   - This ensures your tokens include user roles/groups for RBAC testing!

---

## 3. Environment Readiness Checklist

Before proceeding to Phase 1, ensure you have:
- [ ] Registered Okta preview account and obtained tenant domain (`https://dev-XXXXXX.okta.com`).
- [ ] Created Okta OIDC App Integration with Client ID & Secret.
- [ ] Registered Entra ID App with Tenant ID, Client ID & Client Secret.
- [ ] Copied `.env.example` to `.env` in the root of `Learn IDM`.
