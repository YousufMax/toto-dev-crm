import { Router } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const auditRouter = Router();

// GET recent audit logs
auditRouter.get('/', requirePermission('audit', 'view'), (req: AuthenticatedRequest, res) => {
  const { entityType, entityId, limit } = req.query as Record<string, string>;
  let logs = store.getAuditLogs(limit ? parseInt(limit, 10) : 100);

  if (entityType && entityType !== 'All') {
    logs = logs.filter(l => l.entityType.toLowerCase() === entityType.toLowerCase());
  }

  if (entityId) {
    logs = logs.filter(l => l.entityId.toLowerCase().includes(entityId.toLowerCase()));
  }

  res.json({ success: true, count: logs.length, logs });
});
