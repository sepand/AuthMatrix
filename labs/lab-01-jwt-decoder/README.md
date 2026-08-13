# 🧪 Lab 01: JWT Manual Parsing & Verification

In this lab, you will manually decode JSON Web Tokens (JWT) into their three base64url components:
1. **Header:** Algorithm & Token Type (`alg`, `typ`, `kid`)
2. **Payload:** Claims (`sub`, `iss`, `aud`, `exp`, `roles`, `groups`)
3. **Signature:** Cryptographic signature guaranteeing non-tampering

## Exercise Goals
* Parse raw JWT strings without external SDK magic.
* Understand base64url encoding vs standard base64.
* Check signature validity against public keys.
