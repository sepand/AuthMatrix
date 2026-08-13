import type { APIRoute } from 'astro';
import {
  exchangeCodeForTokens,
  validateIdToken,
  buildOktaSessionToken,
} from '../../../lib/oidc';

/**
 * LAB 2 — Okta OIDC: Step 2 of 2
 * Handles the redirect back from Okta after the user authenticates.
 *
 * What this does:
 *  1. Validates state cookie (CSRF check)
 *  2. Exchanges the authorization code for tokens using code_verifier (PKCE)
 *  3. Validates the ID token signature via Okta's JWKS endpoint (RS256)
 *  4. Extracts groups[] claim and normalizes to internal roles
 *  5. Creates a signed session JWT and sets an HttpOnly cookie
 *  6. Redirects to /dashboard
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code             = url.searchParams.get('code');
  const returnedState    = url.searchParams.get('state');
  const error            = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle IdP-returned errors (e.g. user cancelled login)
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(`Okta error: ${errorDescription || error}`)}`);
  }

  if (!code || !returnedState) {
    return redirect('/login?error=Missing+code+or+state+from+Okta+callback');
  }

  // Step 1: CSRF check — state must match what we generated
  const storedState    = cookies.get('okta_oauth_state')?.value;
  const codeVerifier   = cookies.get('okta_pkce_verifier')?.value;
  cookies.delete('okta_oauth_state',   { path: '/' });
  cookies.delete('okta_pkce_verifier', { path: '/' });

  if (!storedState || storedState !== returnedState) {
    return redirect('/login?error=OAuth+state+mismatch.+Possible+CSRF+attack+detected.');
  }
  if (!codeVerifier) {
    return redirect('/login?error=PKCE+verifier+cookie+missing.+Please+try+again.');
  }

  const issuer      = process.env.OKTA_ISSUER!;
  const clientId    = process.env.OKTA_CLIENT_ID!;
  const clientSecret= process.env.OKTA_CLIENT_SECRET || '';
  const redirectUri = process.env.OKTA_REDIRECT_URI  || 'http://localhost:3000/api/auth/okta-callback';

  try {
    // Step 2: Exchange code for tokens (back-channel, server-to-server)
    const tokens = await exchangeCodeForTokens(
      {
        tokenEndpoint: `${issuer}/v1/token`,
        clientId,
        clientSecret,
        redirectUri,
      },
      code,
      codeVerifier
    );

    if (!tokens.id_token) {
      return redirect('/login?error=Okta+did+not+return+an+ID+token');
    }

    // Step 3: Validate ID token RS256 signature via Okta JWKS
    // Zero Trust: Even though we fetched the token from Okta directly, we
    // still cryptographically verify it (Verify Explicitly principle).
    const jwksUri = `${issuer}/v1/keys`;
    const claims  = await validateIdToken(
      tokens.id_token,
      jwksUri,
      issuer,
      clientId
    );

    // Step 4-5: Normalize groups → roles, build and set session cookie
    const sessionToken = buildOktaSessionToken(claims);
    cookies.set('auth_token', sessionToken, {
      path:     '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge:   60 * 60 * 4, // 4 hours
    });

    // Step 6: Redirect to dashboard
    return redirect('/dashboard');

  } catch (err: any) {
    console.error('[Okta Callback Error]', err.message);
    return redirect(`/login?error=${encodeURIComponent(`Okta authentication failed: ${err.message}`)}`);
  }
};
