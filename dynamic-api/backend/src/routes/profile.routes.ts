import { Router, Response } from 'express';
import { userService } from '../services';
import { authenticate, asyncHandler, AuthenticatedRequest } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await userService.getProfile(req.user!.userId);
  res.json({ success: true, data: profile });
}));

router.put('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await userService.updateProfile(req.user!.userId, req.body);
  res.json({ success: true, data: profile });
}));

export default router;
