import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const LOCAL_MOCK_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

/**
 * Simulates API Gateway Edge Middleware (Azure APIM / Kong / MuleSoft)
 * 1. Strips any incoming untrusted X-User-* headers from external clients.
 * 2. Validates Bearer JWT at the edge.
 * 3. Injects trusted internal X-User-Id and X-User-Roles headers.
 */
export const apiGatewaySimulator = (req: Request, res: Response, next: NextFunction): void => {
  // Step 1: Strip untrusted client headers (Security defense against spoofing)
  delete req.headers['x-user-id'];
  delete req.headers['x-user-roles'];
  delete req.headers['x-user-permissions'];

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Gateway rejects unauthenticated requests at the edge
    res.status(401).json({
      gateway: 'AuthMatrix Edge Gateway Simulator',
      error: 'Unauthorized',
      message: 'Edge Validation Failed: Missing or malformed Authorization header'
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const verifiedPayload = jwt.verify(token, LOCAL_MOCK_SECRET) as any;

    // Step 2: Inject verified claims as trusted HTTP headers for downstream microservices
    req.headers['x-user-id'] = verifiedPayload.sub;
    req.headers['x-user-roles'] = (verifiedPayload.roles || []).join(',');
    req.headers['x-user-permissions'] = (verifiedPayload.permissions || []).join(',');

    console.log(`⚡ [API Gateway Edge] Authenticated user '${verifiedPayload.sub}'. Injected headers: X-User-Roles='${req.headers['x-user-roles']}'`);

    next();
  } catch (err: any) {
    res.status(401).json({
      gateway: 'AuthMatrix Edge Gateway Simulator',
      error: 'Unauthorized',
      message: `Edge Validation Failed: ${err.message}`
    });
  }
};
