import { Router } from 'express';
import { dashboardService, logService, systemService } from '../services';
import { authenticate, requirePermission, asyncHandler } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/stats', requirePermission('view'), asyncHandler(async (_req, res) => {
  const stats = await dashboardService.getStats();
  res.json({ success: true, data: stats });
}));

router.get('/system', requirePermission('view'), asyncHandler(async (_req, res) => {
  const info = await systemService.getInfo();
  res.json({ success: true, data: info });
}));

router.get('/logs', requirePermission('view_logs'), asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const action = req.query.action as string | undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const logs = await logService.getAll(page, limit, action, search);
  res.json({ success: true, data: logs });
}));

export default router;
