# 📖 Phase 1: Authentication, Authorization & RBAC Primitives

> 🛡️ **Zero Trust Lens:** Before connecting to any Identity Provider, internalize the Zero Trust mindset: **never trust, always verify**. Every concept in this phase — AuthN, AuthZ, RBAC, and token signing — exists to enforce this principle at the code level. See [Zero Trust Principles Guide](00a-zero-trust-principles.md) for the foundational framework.

---

## 1. Authentication (AuthN) vs. Authorization (AuthZ)

```
+-----------------------------------------------------------------+
|                       AUTHENTICATION (AuthN)                    |
|  "Who are you?"                                                 |
|  - Proving identity (Credentials, Passwords, Passkeys, MFA)    |
|  - Output: Verified Identity (ID Token, Session User Object)   |
|  ZERO TRUST: Verified on EVERY request, not just at login!     |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                       AUTHORIZATION (AuthZ)                     |
|  "What are you allowed to do?"                                  |
|  - Granting/Restricting access to resources                     |
|  - Input: Verified Identity + Claims / Roles + Resource         |
|  - Output: Access Granted (200 OK) or Access Denied (403)       |
|  ZERO TRUST: Least privilege — only minimum permissions granted |
+-----------------------------------------------------------------+
```

---

## 2. Role-Based Access Control (RBAC) Data Model

In a Zero Trust enterprise application, users are assigned **Roles**, and roles contain fine-grained **Permissions**. Code always checks **permissions**, never individual user IDs or broad role names.

> [!IMPORTANT]
> **Zero Trust Least Privilege Rule:** Never check `if (user.role === 'Admin')` in your API logic. Always check the specific permission required (e.g. `if (user.permissions.includes('delete:users'))`). This ensures that even Admin-level roles can only be granted permissions they explicitly hold, and any privilege escalation is immediately visible.

### Role & Permission Matrix

| Role | Description | Assigned Permissions |
| :--- | :--- | :--- |
| `Admin` | System Administrator with full control | `read:users`, `write:users`, `delete:users`, `read:reports`, `write:settings`, `read:audit` |
| `Manager` | Operational Lead | `read:users`, `read:reports`, `write:reports` |
| `Developer` | Technical Engineer | `read:users`, `read:reports`, `execute:jobs` |
| `Auditor` | Compliance & Security Reader | `read:logs`, `read:reports`, `read:audit` |

---

## 3. Cryptographic Foundation: Symmetric vs. Asymmetric Signing

JWTs and Security Tokens rely on cryptographic signatures to guarantee integrity and authenticity. This is how Zero Trust enables **Verify Explicitly** at the API layer.

### HS256 (Symmetric) — Avoid in Production
* **Secret:** Shared Secret Key (e.g. `my-super-secret-key`).
* **Pros:** Fast, simple — good for local learning labs.
* **Cons:** Both the IdP and every Resource Server must share the same secret. If any service is compromised, all tokens can be forged.
* **Zero Trust Verdict:** ❌ Violates the Assume Breach principle — a single leaked secret compromises the entire trust chain.

### RS256 / ES256 (Asymmetric — Enterprise & Zero Trust Standard)
* **Keys:** Private Key (held strictly by IdP) + Public Key (shared publicly via JWKS endpoint).
* **IdP Action:** Signs JWT payload using the Private Key.
* **API Action:** Verifies signature using the IdP's Public Key fetched from `/.well-known/jwks.json`.
* **Zero Trust Verdict:** ✅ Resource Servers verify tokens independently without sharing secrets. A compromised API cannot forge tokens.

---

## 4. Zero Trust Token Lifecycle: Short-Lived & Rotated

| Token Type | Recommended Lifetime | Zero Trust Rationale |
| :--- | :--- | :--- |
| **Access Token** | 15–60 minutes | Short window limits blast radius if stolen |
| **ID Token** | 15–60 minutes | Re-verify identity at session refresh |
| **Refresh Token** | 8–24 hours (with rotation) | Rotate on use — detect replay attacks via invalidated tokens |
| **M2M Token** | 5–60 minutes | Service-to-service tokens should be short-lived and scoped tightly |

---

## 5. Key Takeaways for Phase 1

1. **Never conflate AuthN and AuthZ:** AuthN proves identity; AuthZ evaluates permissions.
2. **Verify on every request, not just at login** — this is the core of Zero Trust.
3. **Design fine-grained permissions:** Check `read:reports` in API logic, not broad role names.
4. **Use RS256 asymmetric tokens** in production — never share signing secrets with Resource Servers.
5. **Short-lived tokens are a security feature**, not an inconvenience — they limit the window of attack.
