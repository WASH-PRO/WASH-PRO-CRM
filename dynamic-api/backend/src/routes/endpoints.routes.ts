import { Router, Response } from 'express';
import { endpointService, endpointGroupService } from '../services';
import { authenticate, requirePermission, asyncHandler, AuthenticatedRequest } from '../middleware';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('manage_api', 'view'), asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const result = await endpointService.getAll(page, limit);
  res.json({ success: true, data: result });
}));

router.get('/groups', requirePermission('manage_api', 'view'), asyncHandler(async (_req, res) => {
  const groups = await endpointGroupService.getAll();
  res.json({ success: true, data: groups });
}));

router.post('/groups', requirePermission('manage_api'), asyncHandler(async (req, res) => {
  const group = await endpointGroupService.create(req.body);
  res.status(201).json({ success: true, data: group });
}));

router.put('/groups/:id', requirePermission('manage_api'), asyncHandler(async (req, res) => {
  const group = await endpointGroupService.update(paramId(req), req.body);
  res.json({ success: true, data: group });
}));

router.delete('/groups/:id', requirePermission('manage_api'), asyncHandler(async (req, res) => {
  await endpointGroupService.delete(paramId(req));
  res.json({ success: true, message: 'Endpoint group deleted' });
}));

router.get('/:id', requirePermission('manage_api', 'view'), asyncHandler(async (req, res) => {
  const endpoint = await endpointService.getById(paramId(req));
  res.json({ success: true, data: endpoint });
}));

router.post('/', requirePermission('manage_api'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const endpoint = await endpointService.create(req.body, req.user?.userId);
  res.status(201).json({ success: true, data: endpoint });
}));

router.put('/:id', requirePermission('manage_api'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const endpoint = await endpointService.update(paramId(req), req.body, req.user?.userId);
  res.json({ success: true, data: endpoint });
}));

router.delete('/:id', requirePermission('manage_api'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await endpointService.delete(paramId(req), req.user?.userId);
  res.json({ success: true, message: 'Endpoint deleted' });
}));

router.get('/:id/examples', requirePermission('manage_api', 'view'), asyncHandler(async (req, res) => {
  const examples = await endpointService.getExamples(paramId(req));
  res.json({ success: true, data: examples });
}));

router.get('/:id/docs', requirePermission('manage_api', 'view'), asyncHandler(async (req, res) => {
  const docs = await endpointService.getDocumentation(paramId(req));
  res.json({ success: true, data: docs });
}));

router.post('/:id/test', requirePermission('manage_api', 'view'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await endpointService.testEndpoint(paramId(req), req.body, req.user);
  res.json({ success: true, data: result });
}));

export default router;
