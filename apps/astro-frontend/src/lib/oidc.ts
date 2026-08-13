/**
 * OIDC helpers: token exchange, ID token validation (RS256 via native Node.js crypto),
 * claim normalization, and session token creation.
 *
 * Uses only packages already installed (jsonwebtoken, crypto built-in, native fetch).
 * No additional npm packages required.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SESSION_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

// ─── Role/Permission Mapping ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin:     ['read:users', 'write:users', 'delete:users', 'read:reports', 'write:reports', 'write:settings', 'read:audit', 'delete:audit', 'execute:jobs'],
  Manager:   ['read:users', 'read:reports', 'write:reports'],
  Developer: ['read:users', 'read:reports', 'execute:jobs'],
  Auditor:   ['read:audit', 'read:reports'],
};

/**
 * Normalize Okta groups[] to internal application roles.
 * Okta groups include "Everyone" and org-wide groups — filter to known roles only.
 */
function normalizeOktaGroups(groups: string[]): string[] {
  const OKTA_GROUP_TO_ROLE: Record<string, string> = {
    Admin:            'Admin',
    SecurityEngineers:'Admin',
    Managers:         'Manager',
    Developers:       'Developer',
    Auditors:         'Auditor',
    // Add more mappings here as you create Okta groups
  };
  const roles = groups
    .map(g => OKTA_GROUP_TO_ROLE[g])
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
  return roles.length > 0 ? roles : ['Developer']; // fallback default
}

/**
 * Entra App Roles are already named using our internal vocabulary.
 * Just pass them through — no transformation needed.
 */
function normalizeEntraRoles(roles: string[]): string[] {
  const KNOWN_ROLES = new Set(['Admin', 'Manager', 'Developer', 'Auditor']);
  const filtered = roles.filter(r => KNOWN_ROLES.has(r));
  return filtered.length > 0 ? filtered : ['Developer'];
}

function permissionsForRoles(roles: string[]): string[] {
  const perms = new Set<string>();
  for (const role of roles) {
    (ROLE_PERMISSIONS[role] || []).forEach(p => perms.add(p));
  }
  return Array.from(perms);
}

// ─── OIDC Token Exchange ──────────────────────────────────────────────────────

export interface TokenExchangeConfig {
  tokenEndpoint: string;
  clientId:      string;
  clientSecret:  string;
  redirectUri:   string;
}

export interface OidcTokens {
  id_token?:      string;
  access_token:   string;
  refresh_token?: string;
  token_type:     string;
  expires_in:     number;
}

/** Exchange authorization code for tokens via back-channel POST */
export async function exchangeCodeForTokens(
  config: TokenExchangeConfig,
  code: string,
  codeVerifier: string
): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  config.redirectUri,
    code_verifier: codeVerifier,
    client_id:     config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(config.tokenEndpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<OidcTokens>;
}

// ─── ID Token Validation (RS256 via Node.js native crypto + JWKS) ────────────

interface JwksKey {
  kid: string;
  kty: string;
  n:   string;
  e:   string;
  use: string;
  alg: string;
}

/** Fetch JWKS and convert the matching key to a PEM public key string */
async function getPublicKeyPem(jwksUri: string, kid: string | undefined): Promise<string> {
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const { keys }: { keys: JwksKey[] } = await res.json() as any;

  // If no kid in token header, use first available RSA key
  const key = kid
    ? keys.find(k => k.kid === kid)
    : keys.find(k => k.kty === 'RSA');

  if (!key) throw new Error(`No matching key found in JWKS for kid="${kid}"`);

  // Convert JWK (RSA) → PEM using Node.js native crypto (Node 15+)
  const publicKey = crypto.createPublicKey({
    key:    key as unknown as crypto.JsonWebKey,
    format: 'jwk',
  });
  return publicKey.export({ type: 'spki', format: 'pem' }) as string;
}

export interface IdTokenClaims {
  sub:    string;
  email?: string;
  name?:  string;
  groups?: string[];      // Okta
  roles?:  string[];      // Entra
  iss:    string;
  aud:    string | string[];
  exp:    number;
  iat:    number;
}

/**
 * Validate an OIDC ID Token (RS256):
 *  1. Decode header to get kid
 *  2. Fetch JWKS and build PEM public key
 *  3. Verify signature + iss + aud + exp via jsonwebtoken
 */
export async function validateIdToken(
  idToken: string,
  jwksUri: string,
  expectedIssuer: string,
  expectedAudience: string
): Promise<IdTokenClaims> {
  // Decode header (unverified) to extract kid
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid JWT format');
  }

  const kid = (decoded.header as jwt.JwtHeader).kid;
  const pem = await getPublicKeyPem(jwksUri, kid);

  const payload = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    issuer:     expectedIssuer,
    audience:   expectedAudience,
  }) as IdTokenClaims;

  return payload;
}

// ─── Session Token Creation ───────────────────────────────────────────────────

export interface SessionUser {
  sub:         string;
  name:        string;
  email:       string;
  roles:       string[];
  permissions: string[];
  idp:         'okta' | 'entra' | 'local';
  iss:         string;
  aud:         string;
}

/** Build normalized session token from Okta ID token claims */
export function buildOktaSessionToken(claims: IdTokenClaims): string {
  const roles = normalizeOktaGroups(claims.groups || []);
  const user: SessionUser = {
    sub:         claims.sub,
    name:        claims.name || claims.email || 'Okta User',
    email:       claims.email || '',
    roles,
    permissions: permissionsForRoles(roles),
    idp:         'okta',
    iss:         'https://authmatrix.local',
    aud:         'https://api.authmatrix.local',
  };
  return jwt.sign(user, SESSION_SECRET, { expiresIn: '4h' });
}

/** Build normalized session token from Entra ID token claims */
export function buildEntraSessionToken(claims: IdTokenClaims): string {
  const roles = normalizeEntraRoles(claims.roles || []);
  const user: SessionUser = {
    sub:         claims.sub,
    name:        claims.name || claims.email || 'Entra User',
    email:       claims.email || '',
    roles,
    permissions: permissionsForRoles(roles),
    idp:         'entra',
    iss:         'https://authmatrix.local',
    aud:         'https://api.authmatrix.local',
  };
  return jwt.sign(user, SESSION_SECRET, { expiresIn: '4h' });
}
