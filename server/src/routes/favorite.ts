import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/favorites', (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const items = db.prepare(`
    SELECT si.*, d.name as department_name, w.name as window_name, f.id as favorite_id, f.created_at as favorited_at
    FROM favorites f
    INNER JOIN service_items si ON f.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN windows w ON si.window_id = w.id
    WHERE f.user_id = ? AND si.status = 'active'
    ORDER BY f.created_at DESC
  `).all(userId);

  res.json({ items });
});

router.get('/favorites/check/:service_item_id', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { service_item_id } = req.params;

  const favorite = db.prepare(`
    SELECT * FROM favorites WHERE user_id = ? AND service_item_id = ?
  `).get(userId, service_item_id);

  res.json({ is_favorited: !!favorite });
});

router.post('/favorites/:service_item_id', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { service_item_id } = req.params;

  const serviceItem = db.prepare('SELECT id, status, name FROM service_items WHERE id = ?').get(service_item_id) as any;
  if (!serviceItem) {
    return res.status(404).json({ message: '服务事项不存在' });
  }
  if (serviceItem.status !== 'active') {
    return res.status(400).json({ message: '该服务事项已停用，无法收藏' });
  }

  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND service_item_id = ?').get(userId, service_item_id);
  if (existing) {
    return res.status(400).json({ message: '已收藏该服务事项' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO favorites (id, user_id, service_item_id)
    VALUES (?, ?, ?)
  `).run(id, userId, service_item_id);

  const favorite = db.prepare('SELECT * FROM favorites WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '收藏事项', '我的收藏', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `收藏服务事项：${serviceItem.name}`);

  res.status(201).json({ favorite });
});

router.delete('/favorites/:service_item_id', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { service_item_id } = req.params;

  const serviceItem = db.prepare('SELECT name FROM service_items WHERE id = ?').get(service_item_id) as any;

  const favorite = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND service_item_id = ?').get(userId, service_item_id);
  if (!favorite) {
    return res.status(404).json({ message: '未收藏该服务事项' });
  }

  db.prepare('DELETE FROM favorites WHERE user_id = ? AND service_item_id = ?').run(userId, service_item_id);

  if (serviceItem) {
    db.prepare(`
      INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
      VALUES (?, ?, ?, '取消收藏', '我的收藏', ?)
    `).run(uuidv4(), req.user!.id, req.user!.name, `取消收藏服务事项：${serviceItem.name}`);
  }

  res.json({ message: '取消收藏成功' });
});

export default router;
