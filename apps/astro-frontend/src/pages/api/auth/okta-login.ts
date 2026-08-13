import type { APIRoute } from 'astro';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../../../lib/pkce';

/**
 * LAB 2 — Okta OIDC: Step 1 of 2
 * Initiates the Authorization Code + PKCE flow against Okta.
 *
 * What this does:
 *  1. Generates a PKCE code_verifier and SHA-256 hashed code_challenge
 *  2. Generates a random `state` value to prevent CSRF
 *  3. Stores verifier + state in short-lived HttpOnly cookies
 *  4. Redirects the browser to Okta's /authorize endpoint
 *
 * Required .env variables:
 *  OKTA_ISSUER       = https://dev-XXXXX.okta.com/oauth2/default
 *  OKTA_CLIENT_ID    = 0oaXXXXXXXXX
 *  OKTA_REDIRECT_URI = http://localhost:3000/api/auth/okta-callback
 */
export const GET: APIRoute = async ({ cookies, redirect }) => {
  const issuer      = process.env.OKTA_ISSUER;
  const clientId    = process.env.OKTA_CLIENT_ID;
  const redirectUri = process.env.OKTA_REDIRECT_URI || 'http://localhost:3000/api/auth/okta-callback';

  if (!issuer || !clientId) {
    return redirect('/login?error=Okta+not+configured.+Set+OKTA_ISSUER+and+OKTA_CLIENT_ID+in+.env');
  }

  // Step 1: Generate PKCE values
  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state         = generateState();

  // Step 2: Store PKCE + state in short-lived HttpOnly cookies
  const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: 300 };
  cookies.set('okta_pkce_verifier', codeVerifier, cookieOpts);
  cookies.set('okta_oauth_state',   state,         cookieOpts);

  // Step 3: Build Okta /authorize URL
  const authorizeUrl = new URL(`${issuer}/v1/authorize`);
  authorizeUrl.searchParams.set('response_type',         'code');
  authorizeUrl.searchParams.set('client_id',             clientId);
  authorizeUrl.searchParams.set('redirect_uri',          redirectUri);
  authorizeUrl.searchParams.set('scope',                 'openid profile email groups');
  authorizeUrl.searchParams.set('state',                 state);
  authorizeUrl.searchParams.set('code_challenge',        codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  // Step 4: Redirect user to Okta for authentication
  return redirect(authorizeUrl.toString());
};
