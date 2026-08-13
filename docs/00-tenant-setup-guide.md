# 📋 Phase 0: Complete Step-by-Step Identity Provider (IdP) Setup Guide

Welcome to Phase 0 of **AuthMatrix**. This guide provides click-by-click, detailed instructions with exact UI tab names and field locations for configuring **Okta Developer Preview** and **Microsoft Entra ID (Azure AD)**.

---

## 📚 Official Identity Platform Documentation References

| Platform | Core Topic | Official Documentation Link |
| :--- | :--- | :--- |
| **Okta Developer** | OIDC & OAuth 2.0 Overview | [Okta OIDC & OAuth 2.0 API Docs](https://developer.okta.com/docs/concepts/oauth-openid/) |
| **Okta Developer** | Custom Authorization Servers & Claims | [Okta Custom Authorization Servers & Claims](https://developer.okta.com/docs/concepts/auth-servers/) |
| **Okta Developer** | SAML 2.0 Web Apps & Attribute Mapping | [Okta SAML Application Setup Guide](https://developer.okta.com/docs/guides/build-sso-integration/saml2/overview/) |
| **Microsoft Entra** | App Registrations & OIDC | [Microsoft Entra ID App Registration Overview](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) |
| **Microsoft Entra** | OAuth 2.0 Auth Code Flow | [Microsoft Entra Auth Code Flow & PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) |
| **Microsoft Entra** | Enterprise Applications & SAML Claims | [Microsoft Entra SAML Claims & Attributes](https://learn.microsoft.com/en-us/entra/identity-platform/saml-sso-claims-customization) |

---

## 1. Okta Developer Tenant Setup & Step-by-Step Configuration

### A. Register Okta Developer Account & Copy Org URL
1. Navigate to [developer.okta.com/signup](https://developer.okta.com/signup/) and complete the registration form.
2. Check your email for the activation link and initial admin password.
3. Log into your Okta Admin Console (URL format: `https://dev-XXXXXX.okta.com/admin/dashboard`).
4. **Where to find `OKTA_ORG_URL`:**
   * Look at your browser's address bar or click your profile icon in the top-right corner.
   * Copy the domain portion only (e.g. `https://dev-12345678.okta.com`). **Do NOT include `/admin/dashboard`**.
   * Paste this into your `.env` file as `OKTA_ORG_URL`.

---

### B. Configure Okta OIDC Web Application (Phase 2 & Phase 4)
1. In the left navigation menu, go to **Applications** $\rightarrow$ **Applications**.
2. Click the **Create App Integration** button at the top.
3. In the modal:
   * Select **OIDC - OpenID Connect**.
   * Under **Application type**, select **Web Application**.
   * Click **Next**.
4. **General Settings:**
   * **App integration name:** Enter `AuthMatrix OIDC App`.
   * **Grant type:** Ensure **Authorization Code** and **Refresh Token** are checked.
   * **Sign-in redirect URIs:** Enter `http://localhost:3000/authorization-code/callback`.
   * **Sign-out redirect URIs:** Enter `http://localhost:3000`.
   * **Assignments:** Select **Allow everyone in your organization to access** (or assign specific test users).
5. Click **Save**.
6. On the application details page under the **General** tab, copy:
   * **Client ID** $\rightarrow$ paste into `.env` as `OKTA_CLIENT_ID`
   * **Client Secret** $\rightarrow$ paste into `.env` as `OKTA_CLIENT_SECRET`

---

### C. Configure Okta Groups Claim & Copy Issuer URI (Phase 2 & 4)

1. **Where to find `OKTA_ISSUER`:**
   * In the left navigation menu, go to **Security** $\rightarrow$ **API**.
   * On the **Authorization Servers** tab, look at the row for **default**.
   * Copy the value in the **Issuer URI** column (e.g. `https://dev-12345678.okta.com/oauth2/default`).
   * Paste this into your `.env` file as `OKTA_ISSUER`.
2. **Configure Custom Group Claim (For RBAC):**
   * *By default, Okta does NOT include group memberships in Access Tokens. You must configure a Custom Group Claim:*
   * Click on **default** (or click the edit pencil icon next to default).
   * Go to the **Claims** tab.
   * Click **Add Claim**:
     * **Name:** `groups`
     * **Include in token type:** Select **Access Token** $\rightarrow$ **Always**
     * **Value type:** Select **Group filter**
     * **Filter:** Select **Matches regex** from the dropdown, and type `.*` into the input box.
   * Click **Create**. Now Okta access tokens will contain user group memberships (`roles`/`groups`) for RBAC testing!

---

### D. Configure Okta SAML 2.0 Web Application & Attribute Statements (Phase 3)

1. In the left navigation menu, go to **Applications** $\rightarrow$ **Applications**.
2. Click **Create App Integration** $\rightarrow$ Select **SAML 2.0** $\rightarrow$ Click **Next**.
3. **Step 1: General Settings:**
   * **App name:** Enter `AuthMatrix SAML App` $\rightarrow$ Click **Next**.
4. **Step 2: Configure SAML (General Settings):**
   * **Single Sign-On URL (ACS URL):** Enter `http://localhost:3000/saml/acs`.
   * Check **Use this for Recipient URL and Destination URL**.
   * **Audience URI (SP Entity ID):** Enter `https://authmatrix-sp.local`.
   * **Name ID format:** Select `EmailAddress`.
   * **Application username:** Select `Email`.
5. **Step 3: Finish Wizard:**
   * Click **Next** at the bottom.
   * Select **I'm an Okta customer adding an internal app** $\rightarrow$ Click **Finish**.

---

### E. How to Configure Attribute Statements (Claims Mapping) in Okta

> [!IMPORTANT]
> **Use "Show legacy configuration" to access Dropdown Menus:**
> To avoid Okta Expression Language syntax errors, use Okta's built-in **Legacy Configuration** editor on the **Sign On** tab. This provides pre-populated dropdown menus for all user attributes.

#### 🔹 Step-by-Step Instructions (Dropdown Menus)
1. On the **Sign On** tab, scroll down to the bottom of the page.
2. Click the accordion titled **Show legacy configuration** (located below Attribute statements).
3. Click **Edit** next to SAML 2.0 settings.
4. Under **Attribute Statements (optional)**, map the attributes using the dropdown menus:
   * **Name:** `email` | **Name format:** `Unspecified` | **Value:** Select `user.email` from the dropdown
   * **Name:** `firstName` | **Name format:** `Unspecified` | **Value:** Select `user.firstName` from the dropdown
   * **Name:** `lastName` | **Name format:** `Unspecified` | **Value:** Select `user.lastName` from the dropdown
5. Under **Group Attribute Statements (optional)**:
   * **Name:** `groups` | **Name format:** `Unspecified` | **Filter:** `Matches regex` | **Value:** `.*`
6. Click **Save**.

---

### F. Exporting Okta SAML Certificates & Metadata

1. On your app page, click the **Sign On** tab.
2. Scroll down to the **SAML Setup** box on the right.
3. Click **View SAML setup instructions** (or click **Metadata Details**).
4. Copy the following 3 parameters into your `.env` file:
   * **Identity Provider Single Sign-On URL:** Paste into `OKTA_SAML_ENTRY_POINT`
   * **Identity Provider Issuer:** (e.g. `http://www.okta.com/exk123456789`) $\rightarrow$ Paste into `OKTA_SAML_ISSUER`
   * **X.509 Certificate:** Copy the PEM certificate block $\rightarrow$ Paste into `OKTA_SAML_CERT`

> [!IMPORTANT]
> **How to Format Multiline X.509 Certificates in `.env` Files:**
> Standard `.env` parsers (`dotenv`) break if a single variable spans multiple unquoted lines. To format your X.509 certificate correctly in `.env`:
>
> **Option A (Recommended - Escaped Newlines in Double Quotes):**  
> Wrap the entire certificate in double quotes (`"..."`) and replace every line break with `\n`:
> ```env
> OKTA_SAML_CERT="-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAZ/5ZxucMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQGEwJV...\n-----END CERTIFICATE-----"
> ```
>
> **Option B (Multiline Double Quotes):**  
> Keep the exact multiline block, but wrap the entire value inside double quotes (`"..."`):
> ```env
> OKTA_SAML_CERT="-----BEGIN CERTIFICATE-----
> MIIDpDCCAoygAwIBAgIGAZ/5ZxucMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQGEwJV...
> -----END CERTIFICATE-----"
> ```

---

## 2. Microsoft Entra ID (Azure AD) Setup & Step-by-Step Configuration

### A. Access Microsoft Entra Admin Center
1. Open your browser and navigate to [entra.microsoft.com](https://entra.microsoft.com/).
2. Sign in with your admin credentials (or use your free Microsoft 365 Developer sandbox account).

---

### B. Register OIDC Web Application (App Registration)
1. In the left navigation menu, expand **Identity** $\rightarrow$ **Applications** $\rightarrow$ click **App registrations**.
2. Click **+ New registration** at the top.
3. **Registration Form:**
   * **Name:** Enter `AuthMatrix Entra App`.
   * **Supported account types:** Select **Accounts in this organizational directory only (Single tenant)**.
   * **Redirect URI:** Select **Web** from the dropdown, and enter `http://localhost:3000/auth/entra/callback`.
4. Click **Register**.
5. On the App Overview page, copy:
   * **Application (client) ID** $\rightarrow$ paste into `.env` as `ENTRA_CLIENT_ID`
   * **Directory (tenant) ID** $\rightarrow$ paste into `.env` as `ENTRA_TENANT_ID`
6. **Generate Client Secret:**
   * In the left menu under your app, click **Certificates & secrets**.
   * Click **+ New client secret**.
   * Add Description (e.g. `AuthMatrix Dev Secret`) $\rightarrow$ select expiration (e.g. 180 days) $\rightarrow$ click **Add**.
   * **IMPORTANT:** Copy the **Value** column immediately (not the Secret ID!) and paste into `.env` as `ENTRA_CLIENT_SECRET`.

---

### C. Configure Entra Token Group Claims for RBAC
1. Under your App Registration left menu, click **Token configuration**.
2. Click **+ Add groups claim**.
3. In the right blade panel:
   * Check **Security groups** and **Directory roles**.
   * Under ID / Access / SAML dropdowns, select **Group ID** (or `sAMAccountName`).
4. Click **Add**.

---

### D. Configure Microsoft Entra Enterprise SAML Application & Attributes/Claims (Phase 3)
1. In the left navigation menu of Entra Admin Center, go to **Identity** $\rightarrow$ **Applications** $\rightarrow$ **Enterprise applications**.
2. Click **+ New application** at the top.
3. Click **+ Create your own application**.
4. **Form:**
   * What is the name of your app? Enter `AuthMatrix SAML App`.
   * What are you looking to do with your application? Select **Integrate any other application you don't find in the gallery (Non-gallery)**.
5. Click **Create**.
6. On the App Overview page under **Getting Started**, click **2. Set up single sign on** (or click **Single sign-on** in the left menu).
7. Select **SAML** as the single sign-on method.
8. **Basic SAML Configuration (Box 1):**
   * Click **Edit**:
     * **Identifier (Entity ID):** Click *Add identifier* $\rightarrow$ enter `https://authmatrix-sp.local`.
     * **Reply URL (Assertion Consumer Service URL):** Click *Add reply URL* $\rightarrow$ enter `http://localhost:3000/saml/acs`.
   * Click **Save** at the top, then close the blade (`X`).
9. **How & Where to Configure SAML Attributes & Claims (Box 2):**
   * Click **Edit** on **Attributes & Claims** (Box 2):
     * **Unique User Identifier (Name ID):** Click to verify it is set to `user.userprincipalname` or `user.mail`.
     * **Adding Additional Claims:** Click **+ Add new claim**:
       * **Name:** `email` $\rightarrow$ **Source attribute:** `user.mail` (or `user.userprincipalname`) $\rightarrow$ click **Save**.
       * **Name:** `firstName` $\rightarrow$ **Source attribute:** `user.givenname` $\rightarrow$ click **Save**.
       * **Name:** `lastName` $\rightarrow$ **Source attribute:** `user.surname` $\rightarrow$ click **Save**.
     * **Adding Group Claims for RBAC:** Click **+ Add a group claim**:
       * Select **Security groups** or **All groups**.
       * **Source attribute:** Select **Group ID** (or `sAMAccountName`).
       * Click **Save**.
10. **Downloading SAML Certificates & Login URLs (Box 3 & 4):**
    * In **SAML Certificates** (Box 3), download **Certificate (Base64)** and open it in a text editor to copy the X.509 certificate string.
    * In **Set up AuthMatrix SAML App** (Box 4), copy **Login URL** and **Microsoft Entra Identifier** into `.env` (`ENTRA_SAML_ENTRY_POINT`, `ENTRA_SAML_ISSUER`).

---

## 3. Environment Variables Quick Reference Table

| Variable | Description | Where to find in Admin Console | Example Value |
| :--- | :--- | :--- | :--- |
| `OKTA_ORG_URL` | Okta Organization domain | Admin Console Browser URL | `https://dev-12345678.okta.com` |
| `OKTA_ISSUER` | Okta Default Auth Server Issuer | Security $\rightarrow$ API $\rightarrow$ Authorization Servers | `https://dev-12345678.okta.com/oauth2/default` |
| `OKTA_CLIENT_ID` | Okta OIDC Client ID | Applications $\rightarrow$ General tab | `0oaxxxxxxxxxx357` |
| `OKTA_CLIENT_SECRET` | Okta OIDC Client Secret | Applications $\rightarrow$ General tab | `secret_key_12345` |
| `OKTA_SAML_ENTRY_POINT` | Okta SAML SSO Entry Point URL | Applications $\rightarrow$ SAML App $\rightarrow$ Sign On tab $\rightarrow$ View Setup Instructions | `https://dev-12345678.okta.com/app/YOUR_APP_ID/sso/saml` |
| `OKTA_SAML_ISSUER` | Okta SAML Identity Provider Issuer | Applications $\rightarrow$ SAML App $\rightarrow$ Sign On tab $\rightarrow$ View Setup Instructions | `http://www.okta.com/exk123456789` |
| `OKTA_SAML_CERT` | Okta SAML X.509 Certificate | Applications $\rightarrow$ SAML App $\rightarrow$ Sign On tab $\rightarrow$ View Setup Instructions | `"-----BEGIN CERTIFICATE-----\nMIIDpD...\n-----END CERTIFICATE-----"` |
| `ENTRA_TENANT_ID` | Entra Directory Tenant ID | App Registrations $\rightarrow$ Overview | `a1b2c3d4-e5f6-7890-abcd-1234567890ab` |
| `ENTRA_CLIENT_ID` | Entra App Client ID | App Registrations $\rightarrow$ Overview | `f8765432-10ab-cdef-0123-456789abcdef` |
| `ENTRA_CLIENT_SECRET` | Entra Client Secret Value | App Registrations $\rightarrow$ Certificates & Secrets | `secret_value_xyz` |
