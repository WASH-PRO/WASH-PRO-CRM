import { Router, Response } from 'express';
import { dynamicEngine } from '../services';
import { optionalAuth, asyncHandler, AuthenticatedRequest } from '../middleware';
import { getClientIp } from '../utils';

const SYSTEM_PATHS = [
  '/api/auth',
  '/api/users',
  '/api/groups',
  '/api/profile',
  '/api/endpoints',
  '/api/dashboard',
  '/api/health',
  '/api/csrf-token',
];

const router = Router();

router.all('/*', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const fullPath = `/api${req.path}`;

  const isSystemPath = SYSTEM_PATHS.some((sp) => fullPath.startsWith(sp));
  if (isSystemPath) {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
    return;
  }

  const result = await dynamicEngine.handleRequest(
    fullPath,
    req.method,
    req.body,
    req.query as Record<string, string>,
    req.user,
    { ip: getClientIp(req), userAgent: req.headers['user-agent'] as string }
  );

  res.status(result.statusCode).json(result.body);
}));

export default router;
