import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../../apps/astro-frontend/src/lib/pkce.js';

describe('Tier 1 Unit: PKCE (RFC 7636) & State Generation', () => {
  describe('Feature 14 / RFC 7636: Code Verifier Generation', () => {
    it('should generate a base64url encoded verifier string without standard base64 padding or symbols (+, /, =)', () => {
      const verifier = generateCodeVerifier();
      assert.equal(typeof verifier, 'string');
      assert.equal(verifier.includes('+'), false, 'Must not contain +');
      assert.equal(verifier.includes('/'), false, 'Must not contain /');
      assert.equal(verifier.includes('='), false, 'Must not contain =');
      assert.match(verifier, /^[A-Za-z0-9_-]+$/, 'Must match base64url character set');
    });

    it('should generate a verifier within RFC 7636 length bounds (43 to 128 characters)', () => {
      for (let i = 0; i < 20; i++) {
        const verifier = generateCodeVerifier();
        assert.ok(verifier.length >= 43, `Verifier length ${verifier.length} should be >= 43`);
        assert.ok(verifier.length <= 128, `Verifier length ${verifier.length} should be <= 128`);
      }
    });

    it('should generate unique verifiers on each invocation (high entropy)', () => {
      const verifiers = new Set<string>();
      const count = 50;
      for (let i = 0; i < count; i++) {
        verifiers.add(generateCodeVerifier());
      }
      assert.equal(verifiers.size, count, 'All generated verifiers must be distinct');
    });
  });

  describe('Feature 14 / RFC 7636: S256 Code Challenge Generation', () => {
    it('should match the authoritative RFC 7636 Appendix B test vector', () => {
      // RFC 7636 Appendix B:
      // Code Verifier:  dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
      // Code Challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
      const rfcVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedRfcChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const actualChallenge = generateCodeChallenge(rfcVerifier);
      assert.equal(actualChallenge, expectedRfcChallenge);
    });

    it('should be deterministic: same verifier always yields identical challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      const challenge3 = generateCodeChallenge(verifier);

      assert.equal(challenge1, challenge2);
      assert.equal(challenge2, challenge3);
    });

    it('should compute valid SHA-256 base64url digest matching independent crypto implementation', () => {
      const testVerifiers = [
        'test_verifier_string_alpha_numeric_1234567890_abcdef',
        'custom-verifier-with-hyphens-and_underscores.test',
        'a'.repeat(43),
        'z'.repeat(128),
      ];

      for (const verifier of testVerifiers) {
        const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
        const actual = generateCodeChallenge(verifier);
        assert.equal(actual, expected);
      }
    });

    it('should produce distinct challenges for distinct verifiers', () => {
      const v1 = 'verifier_one_sample_value_123456789012345678901234567890';
      const v2 = 'verifier_two_sample_value_123456789012345678901234567890';

      const c1 = generateCodeChallenge(v1);
      const c2 = generateCodeChallenge(v2);
      assert.notEqual(c1, c2);
    });

    it('challenge output should be 43 characters long (32-byte SHA256 digest in base64url)', () => {
      for (let i = 0; i < 10; i++) {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);
        assert.equal(challenge.length, 43);
      }
    });
  });

  describe('Feature 14 / RFC 6749: State Parameter Generation (CSRF Mitigation)', () => {
    it('should generate a 32-character hexadecimal string (16 bytes)', () => {
      const state = generateState();
      assert.equal(state.length, 32);
      assert.match(state, /^[0-9a-f]{32}$/, 'Must be 32 hex characters');
    });

    it('should generate unique state values on each call', () => {
      const states = new Set<string>();
      const count = 50;
      for (let i = 0; i < count; i++) {
        states.add(generateState());
      }
      assert.equal(states.size, count);
    });
  });
});
