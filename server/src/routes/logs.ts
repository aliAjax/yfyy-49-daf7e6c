import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/operation-logs', requireRoles('admin'), (req: AuthRequest, res) => {
  const { user_id, user_name, module, action, start_date, end_date, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params: any[] = [];

  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (user_name) {
    sql += ' AND user_name LIKE ?';
    params.push(`%${user_name}%`);
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

  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params) as any;
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const logs = db.prepare(sql).all(...params);

  res.json({ logs, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/operation-logs/modules', requireRoles('admin'), (req: AuthRequest, res) => {
  const modules = db.prepare('SELECT DISTINCT module FROM operation_logs WHERE module IS NOT NULL ORDER BY module').all();
  res.json({ modules: modules.map((m: any) => m.module) });
});

export function writeOperationLog(userId: string | undefined, userName: string | undefined, action: string, module: string, detail: string, ip?: string) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId || null, userName || null, action, module, detail, ip || null);
}

export default router;
