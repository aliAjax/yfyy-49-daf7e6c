import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/operation-logs', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: '权限不足' });
  }

  const {
    user_id,
    user_name,
    operator,
    module,
    action,
    start_date,
    end_date,
    page = 1,
    pageSize = 20,
  } = req.query as any;

  let sql = 'SELECT rowid as row_id, * FROM operation_logs WHERE 1=1';
  const params: any[] = [];

  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (user_name || operator) {
    sql += ' AND user_name LIKE ?';
    params.push(`%${user_name || operator}%`);
  }
  if (module) {
    sql += ' AND module = ?';
    params.push(module);
  }
  if (action) {
    sql += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }
  if (start_date) {
    sql += ' AND DATE(created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND DATE(created_at) <= ?';
    params.push(end_date);
  }

  const totalSql = sql.replace('SELECT rowid as row_id, *', 'SELECT COUNT(*) as count');
  const total = db.prepare(totalSql).get(...params) as any;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const logs = db.prepare(sql).all(...params).map((log: any) => ({
    ...log,
    id: log.id || `log-${log.row_id}`,
  }));

  res.json({ logs, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/operation-logs/modules', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: '权限不足' });
  }

  const modules = db.prepare(`
    SELECT DISTINCT module
    FROM operation_logs
    WHERE module IS NOT NULL AND module != ''
    ORDER BY module
  `).all().map((row: any) => row.module);

  res.json({ modules });
});

export default router;
