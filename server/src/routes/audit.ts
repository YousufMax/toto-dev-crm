import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const auditRouter = Router();

// GET recent audit logs from PostgreSQL
auditRouter.get('/', requirePermission('audit', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId, limit } = req.query as Record<string, string>;
    let logs = await postgresAuthRepo.getAuditLogs(limit ? parseInt(limit, 10) : 100);

    if (entityType && entityType !== 'All') {
      logs = logs.filter(l => l.entityType.toLowerCase() === entityType.toLowerCase());
    }

    if (entityId) {
      logs = logs.filter(l => l.entityId.toLowerCase().includes(entityId.toLowerCase()));
    }

    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
