import type { APIRoute } from 'astro';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../../../lib/pkce';

/**
 * LAB 3 — Entra ID OIDC: Step 1 of 2
 * Initiates the Authorization Code + PKCE flow against Microsoft Entra ID.
 *
 * What this does:
 *  1. Generates a PKCE code_verifier and SHA-256 hashed code_challenge
 *  2. Generates a random `state` value to prevent CSRF
 *  3. Stores verifier + state in short-lived HttpOnly cookies
 *  4. Redirects the browser to Entra's /authorize endpoint
 *
 * Required .env variables:
 *  ENTRA_TENANT_ID   = your-azure-tenant-id
 *  ENTRA_CLIENT_ID   = your-app-registration-client-id
 *  ENTRA_REDIRECT_URI = http://localhost:3000/api/auth/entra-callback
 */
export const GET: APIRoute = async ({ cookies, redirect }) => {
  const tenantId    = process.env.ENTRA_TENANT_ID;
  const clientId    = process.env.ENTRA_CLIENT_ID;
  const redirectUri = process.env.ENTRA_REDIRECT_URI || 'http://localhost:3000/api/auth/entra-callback';

  if (!tenantId || !clientId) {
    return redirect('/login?error=Entra+not+configured.+Set+ENTRA_TENANT_ID+and+ENTRA_CLIENT_ID+in+.env');
  }

  // Step 1: Generate PKCE values
  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state         = generateState();

  // Step 2: Store PKCE + state in short-lived HttpOnly cookies
  const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: 300 };
  cookies.set('entra_pkce_verifier', codeVerifier, cookieOpts);
  cookies.set('entra_oauth_state',   state,         cookieOpts);

  // Step 3: Build Entra /authorize URL
  const authorizeUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
  );
  authorizeUrl.searchParams.set('response_type',         'code');
  authorizeUrl.searchParams.set('client_id',             clientId);
  authorizeUrl.searchParams.set('redirect_uri',          redirectUri);
  // openid profile email = identity claims; .default = all app-role scopes
  authorizeUrl.searchParams.set('scope',                 `openid profile email api://${clientId}/.default`);
  authorizeUrl.searchParams.set('state',                 state);
  authorizeUrl.searchParams.set('code_challenge',        codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  // Step 4: Redirect user to Entra for authentication
  return redirect(authorizeUrl.toString());
};
