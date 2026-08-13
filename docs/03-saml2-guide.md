# 📖 Phase 3: SAML 2.0 Enterprise Single Sign-On (SSO)

Welcome to Phase 3 of **AuthMatrix**. Security Assertion Markup Language (SAML 2.0) is the foundational standard for enterprise Single Sign-On (SSO) used across legacy corporate IT, federation proxies, and cloud identity management.

---

## 1. SAML 2.0 Terminology & Architecture

```
+-------------------+                    +-------------------+
| Identity Provider |                    | Service Provider  |
|       (IdP)       |                    |       (SP)        |
|  Okta / Entra ID  |                    | AuthMatrix Astro  |
+-------------------+                    +-------------------+
          |                                        |
          |  <--- 1. AuthnRequest (Redirect) ----- |
          |                                        |
          |  ---- 2. SAMLResponse (POST ACS) ----> |
```

* **Service Provider (SP):** The application receiving authentication (AuthMatrix).
* **Identity Provider (IdP):** The centralized enterprise directory issuing signed XML assertions (Okta or Microsoft Entra ID).
* **Assertion Consumer Service (ACS) URL:** The HTTP POST endpoint on the SP where the IdP posts the XML SAML assertion (`http://localhost:3000/saml/acs`).
* **Entity ID:** The unique URI identifier for the SP (`https://authmatrix-sp.local`) and IdP.
* **X.509 Certificate:** Public key certificate exported from IdP used by SP to verify XML digital signatures.

---

## 2. SP-Initiated vs. IdP-Initiated Workflows

| Workflow | Initiated By | Use Case | Security Considerations |
| :--- | :--- | :--- | :--- |
| **SP-Initiated SSO** | User clicks "Login via SAML" on SP web page | Standard web portal authentication | SP generates signed `AuthnRequest` with `InResponseTo` matching validation to prevent CSRF. |
| **IdP-Initiated SSO** | User clicks app tile inside Okta Dashboard or M365 App Launcher | Corporate intranet launching external SaaS apps | Susceptible to Login CSRF / Session Fixation if RelayState is not validated. |

---

## 3. Official Platform SAML Guides

* **Okta SAML 2.0 Integration Guide:** [Okta SAML 2.0 Developer Documentation](https://developer.okta.com/docs/concepts/saml/)
* **Microsoft Entra ID SAML Protocol:** [Microsoft Entra ID SAML 2.0 Single Sign-On](https://learn.microsoft.com/en-us/entra/identity-platform/single-sign-on-saml-protocol)

---

## 4. Dissecting the SAML XML Assertion

```xml
<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol"
                 ID="_a1b2c3d4" Version="2.0" IssueInstant="2026-08-12T19:00:00Z">
    <saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">
        http://www.okta.com/exk123456789
    </saml2:Issuer>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <!-- Digital X.509 Signature proving authenticity -->
    </ds:Signature>
    <saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml2:Subject>
            <saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                john.doe@company.com
            </saml2:NameID>
        </saml2:Subject>
        <saml2:AttributeStatement>
            <saml2:Attribute Name="groups">
                <saml2:AttributeValue>Admin</saml2:AttributeValue>
                <saml2:AttributeValue>SecurityEngineers</saml2:AttributeValue>
            </saml2:Attribute>
        </saml2:AttributeStatement>
    </saml2:Assertion>
</saml2p:Response>
```

---

## 5. Security Defense: SAML Signature Wrapping (XSW) Attacks

> [!CAUTION]
> **SAML Signature Wrapping (XSW)** occurs when an attacker manipulates the XML document structure to relocate a valid signature element away from modified assertion content, deceiving un-strict XML parsers into accepting tampered user IDs (`NameID`).
>
> **Mitigation:** Always validate that the signature specifically covers the `<saml2:Assertion>` element ID, not just the root document tag!
