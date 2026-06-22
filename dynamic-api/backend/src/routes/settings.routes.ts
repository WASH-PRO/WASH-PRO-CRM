import { Router, Response } from 'express';
import { settingsManagementService } from '../services/settings-management.service';
import { authenticate, requirePermission, asyncHandler, AuthenticatedRequest } from '../middleware';
import { logRepository } from '../repositories';

const router = Router();

router.use(authenticate);
router.use(requirePermission('manage_users', 'manage_api'));

router.get('/', asyncHandler(async (_req, res) => {
  const settings = await settingsManagementService.getSettings();
  const logsCount = await logRepository.count();
  res.json({ success: true, data: { settings, logsCount } });
}));

router.put('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const settings = await settingsManagementService.updateSettings(req.body);
  res.json({ success: true, data: settings });
}));

router.delete('/logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await settingsManagementService.clearAllLogs();
  await logRepository.create({
    action: 'error',
    userId: req.user?.userId as unknown as import('mongoose').Types.ObjectId,
    message: `All logs cleared (${deleted} records) by ${req.user?.login}`,
  });
  res.json({ success: true, data: { deleted }, message: `${deleted} log records deleted` });
}));

router.delete('/logs/old', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const deleted = await settingsManagementService.clearOldLogs();
  res.json({ success: true, data: { deleted }, message: `${deleted} old log records deleted` });
}));

export default router;
