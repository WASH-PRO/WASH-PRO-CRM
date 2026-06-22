import { Router, Response } from 'express';
import { userService } from '../services';
import { authenticate, requirePermission, asyncHandler, AuthenticatedRequest } from '../middleware';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('manage_users', 'view'), asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '20'), 10);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await userService.getAll(page, limit, search);
  res.json({ success: true, data: result });
}));

router.get('/:id', requirePermission('manage_users', 'view'), asyncHandler(async (req, res) => {
  const user = await userService.getById(paramId(req));
  res.json({ success: true, data: user });
}));

router.post('/', requirePermission('manage_users'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await userService.create(req.body, req.user?.userId);
  res.status(201).json({ success: true, data: user });
}));

router.put('/:id', requirePermission('manage_users'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await userService.update(paramId(req), req.body, req.user?.userId);
  res.json({ success: true, data: user });
}));

router.delete('/:id', requirePermission('manage_users'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await userService.delete(paramId(req), req.user?.userId);
  res.json({ success: true, message: 'User deleted' });
}));

export default router;
