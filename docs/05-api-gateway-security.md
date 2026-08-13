# 📖 Phase 5: API Gateway Security & Token Injection (Azure APIM, Kong & MuleSoft)

Welcome to Phase 5 of **AuthMatrix**. In enterprise architecture, an **API Gateway** serves as the central perimeter guard for your application ecosystem. Instead of forcing every microservice to independently parse JWTs and connect to IdP JWKS endpoints, the API Gateway centralizes token validation, enforces edge authorization, and transforms identity claims into standardized upstream HTTP headers.

---

## 1. API Gateway Architecture: Edge Security Pattern

```
                                      +-------------------------------------------------+
                                      |              ENTERPRISE API GATEWAY             |
                                      |   (Azure APIM / Kong / MuleSoft / Apigee)       |
                                      |                                                 |
+------------------+                  |  1. Validate Bearer JWT via IdP JWKS            |                  +----------------------+
| Client / SPA /   | -- 1. Bearer ->  |  2. Strip untrusted client headers              | -- 3. Injected ->| Backend Microservice |
| Mobile App       |    JWT Token     |  3. Extract claims (sub, roles, perms)          |    X-User-Roles  | Express / Spring /   |
+------------------+                  |  4. Inject secure upstream HTTP headers         |    X-User-Id     | Astro API Server     |
                                      +-------------------------------------------------+                  +----------------------+
                                                               |
                                                  2. Fetch JWKS Public Keys
                                                               v
                                                      +------------------+
                                                      | IdP (Okta /      |
                                                      | Entra ID)        |
                                                      +------------------+
```

---

## 2. Core Responsibilities of an API Gateway in Identity

1. **Perimeter Authentication (AuthN):** Intercepts incoming `Authorization: Bearer <JWT>` requests and verifies the cryptographic signature against the IdP's JWKS endpoint before traffic enters the internal network.
2. **Claim Extraction & Header Injection:** Parses JWT claims (`sub`, `email`, `groups`, `roles`, `permissions`) and injects them as trusted internal HTTP headers (e.g. `X-User-Id`, `X-User-Roles`, `X-User-Permissions`).
3. **Preventing Header Spoofing (Critical Security Requirement):** Automatically strips any incoming `X-User-*` headers sent by external clients to prevent attackers from injecting fake roles.
4. **Role-Based Throttling & Rate-Limiting:** Applies dynamic rate limits based on token claims (e.g., granting `1,000 req/min` to `Admin`/`Premium` tiers vs `100 req/min` to free users).

---

## 3. Azure API Management (APIM) Implementation Guide

Azure APIM uses an XML-based policy engine executing in `<inbound>`, `<backend>`, `<outbound>`, and `<on-error>` sections.

### Complete Azure APIM Policy (`azure-apim-policy.xml`)

```xml
<policies>
    <inbound>
        <base />
        
        <!-- 1. CRITICAL SECURITY: Strip any incoming untrusted client headers to prevent spoofing -->
        <set-header name="X-User-Id" exists-action="delete" />
        <set-header name="X-User-Roles" exists-action="delete" />
        <set-header name="X-User-Permissions" exists-action="delete" />

        <!-- 2. Edge JWT Signature & Claim Validation -->
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized: Invalid or expired Bearer token" require-scheme="Bearer">
            <!-- Dynamic OpenID Connect Discovery URL for Okta or Entra ID -->
            <openid-config url="https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0/.well-known/openid-configuration" />
            
            <required-claims>
                <!-- Validate Targeted API Audience -->
                <claim name="aud" match="any">
                    <value>https://api.authmatrix.local</value>
                </claim>
            </required-claims>
        </validate-jwt>

        <!-- 3. Claim Extraction into APIM Context Variables -->
        <set-variable name="user-id" value="@(context.Request.Headers.GetValueOrDefault("Authorization","").AsJwt()?.Subject)" />
        <set-variable name="user-roles" value="@(string.Join(",", context.Request.Headers.GetValueOrDefault("Authorization","").AsJwt()?.Claims.GetValueOrDefault("roles", new string[0])))" />

        <!-- 4. Inject Verified Claims as Internal Upstream Headers -->
        <set-header name="X-User-Id" exists-action="override">
            <value>@(context.Variables.GetValueOrDefault<string>("user-id"))</value>
        </set-header>
        <set-header name="X-User-Roles" exists-action="override">
            <value>@(context.Variables.GetValueOrDefault<string>("user-roles"))</value>
        </set-header>

        <!-- 5. Role-Based Throttling / Rate Limiting at the Edge -->
        <choose>
            <when condition="@(context.Variables.GetValueOrDefault<string>("user-roles").Contains("Admin"))">
                <rate-limit-by-key calls="1000" renewal-period="60" counter-key="@(context.Variables.GetValueOrDefault<string>("user-id"))" />
            </when>
            <otherwise>
                <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Variables.GetValueOrDefault<string>("user-id"))" />
            </otherwise>
        </choose>
    </inbound>
    
    <backend>
        <base />
    </backend>
    
    <outbound>
        <base />
    </outbound>
    
    <on-error>
        <base />
    </on-error>
</policies>
```

---

## 4. Vendor-Agnostic Comparison: How Other Gateways Execute the Same Pattern

### A. Kong Gateway (Open Source & Enterprise)
In Kong, edge JWT validation and header transformation are executed using plugins configured declaratively in `kong.yml`:
* **Plugin 1 (`openid-connect` or `jwt`):** Connects to Okta/Entra `issuer` and validates RS256 signature via JWKS.
* **Plugin 2 (`request-transformer`):** Extracts claims from authenticated token context and appends upstream headers (`config.add.headers: ["X-User-Id:$(headers.authorization.claims.sub)", "X-User-Roles:$(headers.authorization.claims.roles)"]`).

### B. MuleSoft Anypoint Platform
In MuleSoft, API Manager applies out-of-the-box policies to RAML/OAS API specifications:
* **JWT Validation Policy:** Specifies Issuer, Audience, and JWKS URL (`https://dev-XXXXX.okta.com/oauth2/default/v1/keys`).
* **Header Injection:** Uses DataWeave in an inbound Flow to set HTTP Request Headers:
  ```dataweave
  %dw 2.0
  output application/java
  ---
  {
    "X-User-Id": authentication.principal.claims.sub,
    "X-User-Roles": authentication.principal.claims.roles joinBy ","
  }
  ```

### C. AWS API Gateway & Google Cloud Apigee
* **AWS API Gateway:** Uses a **JWT Authorizer** (for HTTP APIs) or **Lambda Request Authorizer** to validate tokens, passing context variables (`$context.authorizer.claims.sub`) directly to integration request headers.
* **Apigee:** Uses the **`VerifyJWT` Policy** followed by an **`AssignMessage` Policy** to inject `<Set><Headers><Header name="X-User-Roles">{jwt.VerifyJWT.claim.roles}</Header></Headers></Set>`.

---

## 5. Summary: Security Architecture Best Practices

| Security Risk | Gateway Mitigation Strategy |
| :--- | :--- |
| **Header Spoofing** | Always execute `<set-header name="X-User-*" exists-action="delete" />` **before** processing or injecting headers. |
| **Excessive Microservice Load** | Cache IdP JWKS public keys at the Gateway layer (`jwksRequestsPerMinute: 10`, TTL: 24h). |
| **Bypassing Gateway Edge** | Secure backend microservices so they only accept traffic originating from the API Gateway's internal IP / VNet or require mutual TLS (mTLS). |
