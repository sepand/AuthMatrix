---
trigger: always_on
---

# 🛡️ Supply Chain Security: 7-Day Package Release Age Guardrail

Whenever installing, upgrading, or modifying project dependencies (via `npm`, `yarn`, `pip`, etc.):

1. **Verify Package Release Date:** Check that the targeted package version was published on the registry at least **7 days prior** to the current date.
2. **Reject Fresh Releases (< 7 days old):** Do NOT install package versions that were released less than 7 days ago.
3. **Defense Against Supply Chain Attacks:** This rule mitigates risks from typosquatting, compromised maintainer credentials, and emergency malicious version pushes.
