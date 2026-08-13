import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

// Extend Express Request to hold authenticated User Identity & Claims
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email?: string;
    name?: string;
    roles?: string[];
    permissions?: string[];
    iss?: string;
    aud?: string | string[];
  };
}

// Local mock secret for Phase 1 local testing
const LOCAL_MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

/**
 * Validates JWT Bearer Tokens in incoming Authorization headers.
 * Supports both local secret verification (Phase 1) and dynamic JWKS verification (Phase 4).
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected format: Bearer <token>'
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Decode token header without verifying to check algorithm & key ID
    const decodedToken = jwt.decode(token, { complete: true });
    
    if (!decodedToken || typeof decodedToken === 'string') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid JWT format' });
      return;
    }

    const { header, payload } = decodedToken;

    // Phase 1 / Local mode fallback verification
    if (header.alg === 'HS256') {
      const verifiedPayload = jwt.verify(token, LOCAL_MOCK_SECRET) as any;
      req.user = verifiedPayload;
      next();
      return;
    }

    // Phase 4 Enterprise RS256 / JWKS verification
    if (header.alg === 'RS256' && typeof payload !== 'string' && payload.iss) {
      const jwksUri = `${payload.iss.replace(/\/$/, '')}/.well-known/jwks.json`;
      
      const client = jwksRsa({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri
      });

      client.getSigningKey(header.kid, (err, key) => {
        if (err || !key) {
          res.status(401).json({ error: 'Unauthorized', message: `JWKS Key Lookup Failed: ${err?.message || 'Key not found'}` });
          return;
        }

        const signingKey = key.getPublicKey();
        try {
          const verifiedPayload = jwt.verify(token, signingKey, {
            algorithms: ['RS256']
          }) as any;

          req.user = verifiedPayload;
          next();
        } catch (verifyError: any) {
          res.status(401).json({ error: 'Unauthorized', message: `Token signature verification failed: ${verifyError.message}` });
        }
      });
      return;
    }

    res.status(401).json({ error: 'Unauthorized', message: `Unsupported algorithm: ${header.alg}` });
  } catch (error: any) {
    res.status(401).json({ error: 'Unauthorized', message: error.message });
  }
};

/**
 * Middleware factory for fine-grained Role-Based & Permission-Based Access Control (RBAC)
 */
export const requirePermission = (requiredPermission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User identity not found on request' });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const userRoles = req.user.roles || [];

    // Check if permission is directly held OR if user has Admin role
    const hasAccess = userPermissions.includes(requiredPermission) || userRoles.includes('Admin');

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient privileges. Required permission: '${requiredPermission}'`,
        userRoles,
        userPermissions
      });
      return;
    }

    next();
  };
};
