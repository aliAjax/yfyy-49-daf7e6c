import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 获取我的通知
router.get('/my', (req: AuthRequest, res) => {
  const { is_read, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: any[] = [req.user!.id];

  if (is_read !== undefined) {
    sql += ' AND is_read = ?';
    params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
  }

  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params) as any;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const notifications = db.prepare(sql).all(...params);

  res.json({ notifications, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取未读数量
router.get('/unread-count', (req: AuthRequest, res) => {
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user!.id) as any;

  res.json({ unread_count: result.count });
});

// 标记为已读
router.post('/:id/read', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any;
  
  if (!notification || notification.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权操作此通知' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

  res.json({ message: '标记成功' });
});

// 全部标记为已读
router.post('/read-all', (req: AuthRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
    .run(req.user!.id);

  res.json({ message: '全部标记为已读' });
});

// 删除通知
router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any;
  
  if (!notification || notification.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权操作此通知' });
  }

  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);

  res.json({ message: '删除成功' });
});

// 操作日志列表
router.get('/logs', (req: AuthRequest, res) => {
  const { user_id, module, action, page = 1, pageSize = 20 } = req.query as any;
  
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: '权限不足' });
  }

  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params: any[] = [];

  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (module) {
    sql += ' AND module = ?';
    params.push(module);
  }
  if (action) {
    sql += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params) as any;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const logs = db.prepare(sql).all(...params);

  res.json({ logs, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

export default router;
