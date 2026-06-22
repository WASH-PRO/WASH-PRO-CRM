import { Router, Response } from 'express';
import { authService } from '../services';
import { authenticate, asyncHandler, AuthenticatedRequest } from '../middleware';
import { checkAuthLockout, recordFailedLogin, clearLoginAttempts } from '../middleware/rateLimit';
import { getClientIp } from '../utils';
import { LoginDto, RegisterDto } from '../dto';

const router = Router();

router.post('/login', checkAuthLockout, asyncHandler(async (req, res) => {
  const dto: LoginDto = req.body;
  if (!dto.login || !dto.password) {
    res.status(400).json({ success: false, error: 'Login and password are required' });
    return;
  }
  try {
    const result = await authService.login(dto, req);
    clearLoginAttempts(getClientIp(req));
    res.json({ success: true, data: result });
  } catch (error) {
    recordFailedLogin(getClientIp(req));
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : 'Login failed' });
  }
}));

router.post('/register', asyncHandler(async (req, res) => {
  const { settingsService } = await import('../services/settings.service');
  if (!settingsService.getCached().enableRegistration) {
    res.status(403).json({ success: false, error: 'Registration is disabled' });
    return;
  }
  const dto: RegisterDto = req.body;
  if (!dto.login || !dto.email || !dto.password || !dto.name) {
    res.status(400).json({ success: false, error: 'All fields are required' });
    return;
  }
  try {
    const user = await authService.register(dto, req);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Registration failed' });
  }
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token is required' });
    return;
  }
  try {
    const result = await authService.refresh(refreshToken);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}));

router.post('/logout', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await authService.logout(req.user!.userId, req);
  res.json({ success: true, message: 'Logged out successfully' });
}));

export default router;
