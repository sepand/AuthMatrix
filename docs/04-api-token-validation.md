# 📖 Phase 4: API Security, JWKS & Token Validation (Resource Server Pattern)

Welcome to Phase 4 of **AuthMatrix**. In modern cloud architecture, APIs and Microservices act as **Resource Servers**. They never prompt users for passwords; instead, they inspect, decode, and cryptographically verify Bearer tokens issued by Authorization Servers (Okta or Microsoft Entra ID).

---

## 1. The Resource Server Decoupled Pattern

```
+---------------+                +------------------------+                +------------------+
| Client App    | -- 1. Bearer ->| Resource Server API    | -- 2. JWKS --->| Authorization    |
| Astro Web /   |    Access      | Express (Port 4000)    |    Public Keys | Server (Okta /   |
| Mobile / M2M  |    Token       | (Validates RS256 Signature)              | Entra ID)        |
+---------------+                +------------------------+                +------------------+
```

---

## 2. Token Validation Step-by-Step Checklist

Every secure Resource Server API MUST execute the following checks before granting access:

1. **Header Extraction:** Extract `Authorization: Bearer <TOKEN>` header. Reject missing or malformed headers with `401 Unauthorized`.
2. **Algorithm Check:** Ensure `header.alg` is `RS256` or `ES256`. **Never allow `alg: none`!**
3. **Key ID (`kid`) Lookup:** Extract `header.kid` and retrieve the matching public key from the IdP's JWKS endpoint (`/.well-known/jwks.json`).
4. **Signature Verification:** Use the public key to verify the cryptographic signature.
5. **Issuer (`iss`) Validation:** Assert that `payload.iss` exactly matches your expected IdP issuer URL (e.g. `https://dev-123456.okta.com/oauth2/default` or `https://login.microsoftonline.com/TENANT_ID/v2.0`).
6. **Audience (`aud`) Validation:** Assert that `payload.aud` matches your API's targeted audience identifier (e.g. `https://api.authmatrix.local`).
7. **Expiration (`exp`) & Not-Before (`nbf`) Checks:** Reject expired tokens (`exp < currentTime`).
8. **Scope / Role Authorization:** Assert that `payload.scp` or `payload.groups`/`payload.roles` contain the required permissions for the endpoint.

---

## 3. Machine-to-Machine (M2M) OAuth 2.0 Client Credentials Grant

When two backend services communicate directly without a human user in the loop:

```mermaid
sequenceDiagram
    participant ServiceA as Backend Service A (Client)
    participant IdP as Okta / Entra Authorization Server
    participant ServiceB as Resource Server API B

    ServiceA->>IdP: POST /token (grant_type=client_credentials, client_id, client_secret, scope)
    IdP-->>ServiceA: Return M2M Access Token (JWT)
    ServiceA->>ServiceB: GET /api/v1/data (Authorization: Bearer M2M_ACCESS_TOKEN)
    ServiceB->>ServiceB: Validate JWKS Signature & Scopes
    ServiceB-->>ServiceA: 200 OK (Protected Payload)
```

---

## 4. Official Platform API Security Documentation

* **Okta API Access Management:** [Validate Access Tokens in Okta](https://developer.okta.com/docs/guides/validate-access-tokens/)
* **Microsoft Entra ID Protected APIs:** [Validate Tokens in Protected Web APIs](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-overview)
