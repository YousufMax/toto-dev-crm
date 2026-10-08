import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const auditRouter = Router();

// GET recent audit logs from PostgreSQL (with Store fallback)
auditRouter.get('/', requirePermission('audit', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId, limit } = req.query as Record<string, string>;
    const logLimit = limit ? parseInt(limit, 10) : 100;
    let logs: any[] = [];
    try {
      logs = await postgresAuthRepo.getAuditLogs(logLimit);
    } catch (e) {
      logs = store.getAuditLogs(logLimit);
    }
    if (!logs || logs.length === 0) {
      logs = store.getAuditLogs(logLimit);
    }

    if (entityType && entityType !== 'All') {
      logs = logs.filter(l => l.entityType.toLowerCase() === entityType.toLowerCase());
    }

    if (entityId) {
      logs = logs.filter(l => l.entityId.toLowerCase().includes(entityId.toLowerCase()));
    }

    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.json({ success: true, count: 0, logs: [] });
  }
});
