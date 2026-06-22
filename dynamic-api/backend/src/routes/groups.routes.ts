import { Router } from 'express';
import { groupService } from '../services';
import { authenticate, requirePermission, asyncHandler } from '../middleware';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('manage_users', 'view'), asyncHandler(async (_req, res) => {
  const groups = await groupService.getAll();
  res.json({ success: true, data: groups });
}));

router.get('/:id', requirePermission('manage_users', 'view'), asyncHandler(async (req, res) => {
  const group = await groupService.getById(paramId(req));
  res.json({ success: true, data: group });
}));

router.post('/', requirePermission('manage_users'), asyncHandler(async (req, res) => {
  const group = await groupService.create(req.body);
  res.status(201).json({ success: true, data: group });
}));

router.put('/:id', requirePermission('manage_users'), asyncHandler(async (req, res) => {
  const group = await groupService.update(paramId(req), req.body);
  res.json({ success: true, data: group });
}));

router.delete('/:id', requirePermission('manage_users'), asyncHandler(async (req, res) => {
  await groupService.delete(paramId(req));
  res.json({ success: true, message: 'Group deleted' });
}));

export default router;
