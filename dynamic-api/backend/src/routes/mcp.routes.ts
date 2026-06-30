import { Router, Response } from 'express';
import { mcpService } from '../services';
import { asyncHandler, authenticate, requirePermission, AuthenticatedRequest } from '../middleware';

const router = Router();

router.get('/tools', authenticate, requirePermission('manage_api'), asyncHandler(async (_req, res) => {
  const tools = await mcpService.listAllTools();
  res.json({ success: true, data: tools });
}));

router.post('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const body = req.body;
  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((item) => mcpService.handleJsonRpc(item, user)));
    res.json(responses);
    return;
  }
  const response = await mcpService.handleJsonRpc(body, user);
  res.json(response);
}));

export default router;
