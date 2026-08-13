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

### A. Register Okta Developer Account
1. Navigate to [developer.okta.com/signup](https://developer.okta.com/signup/) and complete the registration form.
2. Check your email for the activation link and initial admin password.
3. Log into your Okta Admin Console (URL format: `https://dev-XXXXXX.okta.com/admin/dashboard`).

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

### C. Configure Okta Groups Claim in Custom Authorization Server (Phase 2 & 4)
*By default, Okta does NOT include group memberships in Access Tokens. You must configure a Custom Group Claim in your Default Authorization Server:*
1. In the left navigation menu, go to **Security** $\rightarrow$ **API**.
2. Under the **Authorization Servers** tab, click on **default** (or click the edit pencil icon).
3. Go to the **Claims** tab.
4. Click **Add Claim**:
   * **Name:** `groups`
   * **Include in token type:** Select **Access Token** $\rightarrow$ **Always**
   * **Value type:** Select **Group filter**
   * **Filter:** Select **Matches regex** from the dropdown, and type `.*` into the input box.
5. Click **Create**. Now Okta access tokens will contain user group memberships (`roles`/`groups`) for RBAC testing!

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

*Okta features two UI layouts depending on your tenant version. Follow either **Path 1 (New UI)** or **Path 2 (Legacy UI)** below:*

#### 🔹 Path 1: New Okta UI ("Add expression" Modal)
1. On your app page, click the **Sign On** tab.
2. Scroll down to the **Attribute statements** section.
3. Click the blue **Add expression** button.
4. In the **Add expression** modal popup, enter:
   * **Name:** `email`
   * **Expression:** `user.email`
   * Click **Save**.
5. Click **Add expression** again for each additional attribute:
   * **Name:** `firstName` | **Expression:** `user.firstName` $\rightarrow$ click **Save**
   * **Name:** `lastName` | **Expression:** `user.lastName` $\rightarrow$ click **Save**
   * **Name:** `groups` | **Expression:** `user.getGroups()` $\rightarrow$ click **Save**

#### 🔹 Path 2: Classic / Legacy Okta UI ("Show legacy configuration")
1. On the **Sign On** tab, scroll down to the bottom and click **Show legacy configuration**.
2. Click **Edit** on SAML 2.0 settings.
3. Under **Attribute Statements (optional)**, enter:
   * **Name:** `email` | **Name format:** `Unspecified` | **Value:** `user.email`
   * **Name:** `firstName` | **Name format:** `Unspecified` | **Value:** `user.firstName`
   * **Name:** `lastName` | **Name format:** `Unspecified` | **Value:** `user.lastName`
4. Under **Group Attribute Statements (optional)**:
   * **Name:** `groups` | **Name format:** `Unspecified` | **Filter:** `Matches regex` | **Value:** `.*`
5. Click **Save**.

---

### F. Exporting Okta SAML Certificates & Metadata
1. On the **Sign On** tab, scroll down to the **SAML Setup** box on the right.
2. Click **View SAML setup instructions** (or click **Metadata Details** to copy the Metadata URL / Certificate).
3. Copy the **Identity Provider Single Sign-On URL** and **X.509 Certificate** into your `.env` file (`OKTA_SAML_ENTRY_POINT`, `OKTA_SAML_CERT`).

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
| `ENTRA_TENANT_ID` | Entra Directory Tenant ID | App Registrations $\rightarrow$ Overview | `a1b2c3d4-e5f6-7890-abcd-1234567890ab` |
| `ENTRA_CLIENT_ID` | Entra App Client ID | App Registrations $\rightarrow$ Overview | `f8765432-10ab-cdef-0123-456789abcdef` |
| `ENTRA_CLIENT_SECRET` | Entra Client Secret Value | App Registrations $\rightarrow$ Certificates & Secrets | `secret_value_xyz` |
