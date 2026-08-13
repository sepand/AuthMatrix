import crypto from 'crypto';

/** Generate a cryptographically random PKCE code_verifier (RFC 7636) */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hash the verifier to produce the code_challenge */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** Generate an opaque, random state parameter for CSRF protection */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}
