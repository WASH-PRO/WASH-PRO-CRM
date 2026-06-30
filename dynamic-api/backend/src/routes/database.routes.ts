import { Router, Response } from 'express';
import { databaseService } from '../services/database.service';
import { authenticate, requirePermission, asyncHandler, AuthenticatedRequest } from '../middleware';
import { paramId } from '../utils/params';

const router = Router();

function paramCollection(req: { params: Record<string, string | string[]> }): string {
  const name = req.params.name;
  return Array.isArray(name) ? name[0] : name;
}

router.use(authenticate);
router.use(requirePermission('manage_users'));

router.get('/collections', asyncHandler(async (_req, res) => {
  const collections = await databaseService.listCollections();
  res.json({ success: true, data: collections });
}));

router.get('/collections/:name', asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await databaseService.listDocuments(paramCollection(req), page, limit, search);
  res.json({ success: true, data: result });
}));

router.get('/collections/:name/:id', asyncHandler(async (req, res) => {
  const doc = await databaseService.getDocument(paramCollection(req), paramId(req));
  res.json({ success: true, data: doc });
}));

router.post('/collections/:name', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const doc = await databaseService.createDocument(paramCollection(req), req.body, req.user?.userId);
  res.status(201).json({ success: true, data: doc });
}));

router.put('/collections/:name/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const doc = await databaseService.updateDocument(
    paramCollection(req),
    paramId(req),
    req.body,
    req.user?.userId
  );
  res.json({ success: true, data: doc });
}));

router.delete('/collections/:name/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await databaseService.deleteDocument(paramCollection(req), paramId(req), req.user?.userId);
  res.json({ success: true, message: 'Document deleted' });
}));

router.delete('/collections/:name', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await databaseService.clearCollection(paramCollection(req), req.user?.userId);
  res.json({ success: true, data: result, message: 'Collection cleared' });
}));

export default router;
