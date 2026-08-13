import type { APIRoute } from 'astro';
import {
  exchangeCodeForTokens,
  validateIdToken,
  buildEntraSessionToken,
} from '../../../lib/oidc';

/**
 * LAB 3 — Entra ID OIDC: Step 2 of 2
 * Handles the redirect back from Microsoft Entra ID after user authenticates.
 *
 * What this does:
 *  1. Validates state cookie (CSRF check)
 *  2. Exchanges the authorization code for tokens using code_verifier (PKCE)
 *  3. Validates the ID token signature via Entra's JWKS endpoint (RS256)
 *  4. Extracts roles[] claim (Entra App Roles — already internal vocabulary)
 *  5. Creates a signed session JWT and sets an HttpOnly cookie
 *  6. Redirects to /dashboard
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code             = url.searchParams.get('code');
  const returnedState    = url.searchParams.get('state');
  const error            = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle IdP-returned errors
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(`Entra error: ${errorDescription || error}`)}`);
  }

  if (!code || !returnedState) {
    return redirect('/login?error=Missing+code+or+state+from+Entra+callback');
  }

  // Step 1: CSRF check
  const storedState  = cookies.get('entra_oauth_state')?.value;
  const codeVerifier = cookies.get('entra_pkce_verifier')?.value;
  cookies.delete('entra_oauth_state',   { path: '/' });
  cookies.delete('entra_pkce_verifier', { path: '/' });

  if (!storedState || storedState !== returnedState) {
    return redirect('/login?error=OAuth+state+mismatch.+Possible+CSRF+attack+detected.');
  }
  if (!codeVerifier) {
    return redirect('/login?error=PKCE+verifier+cookie+missing.+Please+try+again.');
  }

  const tenantId    = process.env.ENTRA_TENANT_ID!;
  const clientId    = process.env.ENTRA_CLIENT_ID!;
  const clientSecret= process.env.ENTRA_CLIENT_SECRET || '';
  const redirectUri = process.env.ENTRA_REDIRECT_URI  || 'http://localhost:3000/api/auth/entra-callback';

  try {
    // Step 2: Exchange code for tokens (back-channel, server-to-server)
    const tokens = await exchangeCodeForTokens(
      {
        tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        clientId,
        clientSecret,
        redirectUri,
      },
      code,
      codeVerifier
    );

    if (!tokens.id_token) {
      return redirect('/login?error=Entra+did+not+return+an+ID+token');
    }

    // Step 3: Validate ID token signature via Entra JWKS
    // Entra JWKS URI: https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys
    const jwksUri     = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
    const expectedIss = `https://login.microsoftonline.com/${tenantId}/v2.0`;

    const claims = await validateIdToken(
      tokens.id_token,
      jwksUri,
      expectedIss,
      clientId
    );

    // Step 4-5: Normalize Entra roles → session cookie
    const sessionToken = buildEntraSessionToken(claims);
    cookies.set('auth_token', sessionToken, {
      path:     '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge:   60 * 60 * 4, // 4 hours
    });

    // Step 6: Redirect to dashboard
    return redirect('/dashboard');

  } catch (err: any) {
    console.error('[Entra Callback Error]', err.message);
    return redirect(`/login?error=${encodeURIComponent(`Entra authentication failed: ${err.message}`)}`);
  }
};
