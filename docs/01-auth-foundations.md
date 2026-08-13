# 📖 Phase 1: Authentication, Authorization & Local RBAC Primitives

Welcome to Phase 1 of **Learn IDM**. Before connecting to enterprise Identity Providers (Okta or Entra ID), you must master the fundamental building blocks of modern identity engineering.

---

## 1. Authentication (AuthN) vs. Authorization (AuthZ)

```
+-----------------------------------------------------------------+
|                       AUTHENTICATION (AuthN)                    |
|  "Who are you?"                                                 |
|  - Proving identity (Credentials, Passwords, Passkeys, MFA)     |
|  - Output: Verified Identity (ID Token, Session User Object)   |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                       AUTHORIZATION (AuthZ)                     |
|  "What are you allowed to do?"                                  |
|  - Granting/Restricting access to resources                     |
|  - Input: Verified Identity + Claims / Roles + Resource         |
|  - Output: Access Granted (200 OK) or Access Denied (403)       |
+-----------------------------------------------------------------+
```

---

## 2. Role-Based Access Control (RBAC) Data Model

In an enterprise application, users are assigned **Roles**, and roles contain **Permissions**. Code checks permissions (or roles), never individual user IDs.

### Role & Permission Matrix

| Role | Description | Assigned Permissions |
| :--- | :--- | :--- |
| `Admin` | System Administrator with full control | `read:users`, `write:users`, `delete:users`, `read:reports`, `write:settings` |
| `Manager` | Operational Lead | `read:users`, `read:reports`, `write:reports` |
| `Developer` | Technical Engineer | `read:users`, `read:reports`, `execute:jobs` |
| `Auditor` | Compliance & Security Reader | `read:logs`, `read:reports`, `read:audit` |

---

## 3. Cryptographic Foundation: Symmetric vs. Asymmetric Signing

JWTs and Security Tokens rely on cryptographic signatures to guarantee integrity and authenticity.

### HS256 (Symmetric)
* **Secret:** Shared Secret Key (e.g. `my-super-secret-key`).
* **Pros:** Fast, simple.
* **Cons:** Both the token generator (IdP) and token verifier (API) must share the secret. If the API key leaks, anyone can forge tokens.

### RS256 / ES256 (Asymmetric - Enterprise Standard)
* **Keys:** Private Key (held strictly by IdP) + Public Key (shared publicly via JWKS endpoint).
* **IdP Action:** Signs JWT payload using Private Key.
* **API Action:** Verifies JWT signature using Public Key.
* **Why it matters:** Resource Servers (APIs) can verify tokens without needing access to secret credentials!

---

## 4. Key Takeaways for Phase 1
1. **Never conflate AuthN and AuthZ:** AuthN proves identity; AuthZ evaluates permissions.
2. **Design fine-grained permissions:** Check permissions (`read:reports`) in API logic rather than hardcoding role names (`if (user.role == 'Admin')`).
3. **Understand JWKS:** Enterprise IdPs publish their public keys in JSON Web Key Set (JWKS) format at standard endpoints.
