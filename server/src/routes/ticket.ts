import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);

// 获取当前等待队列
router.get('/queue', (req: AuthRequest, res) => {
  const { window_id, service_item_id } = req.query as any;
  
  let sql = `
    SELECT t.*, si.name as service_item_name, si.code as service_item_code
    FROM tickets t
    LEFT JOIN service_items si ON t.service_item_id = si.id
    WHERE t.status IN ('waiting', 'calling')
  `;
  const params: any[] = [];

  if (window_id) {
    sql += ' AND t.window_id = ?';
    params.push(window_id);
  }
  if (service_item_id) {
    sql += ' AND t.service_item_id = ?';
    params.push(service_item_id);
  }

  sql += ' ORDER BY t.created_at ASC';
  const tickets = db.prepare(sql).all(...params);

  res.json({ tickets });
});

// 获取我的取号记录
router.get('/my', (req: AuthRequest, res) => {
  const { status, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT t.*, si.name as service_item_name, w.name as window_name, w.number as window_number
    FROM tickets t
    LEFT JOIN service_items si ON t.service_item_id = si.id
    LEFT JOIN windows w ON t.window_id = w.id
    WHERE t.user_id = ?
  `;
  const params: any[] = [req.user!.id];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }

  const total = db.prepare(sql.replace(
    'SELECT t.*, si.name as service_item_name, w.name as window_name, w.number as window_number',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const tickets = db.prepare(sql).all(...params);

  res.json({ tickets, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 现场取号
router.post('/issue', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { service_item_id, applicant_name, applicant_phone, appointment_id } = req.body;
  
  if (!service_item_id) {
    return res.status(400).json({ message: '请选择服务事项' });
  }

  const serviceItem = db.prepare('SELECT * FROM service_items WHERE id = ? AND status = ?')
    .get(service_item_id, 'active') as any;
  
  if (!serviceItem) {
    return res.status(400).json({ message: '服务事项不存在或已停用' });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const countResult = db.prepare(
    "SELECT COUNT(*) as count FROM tickets WHERE service_item_id = ? AND DATE(created_at) = ?"
  ).get(service_item_id, today) as any;
  
  const ticketNumber = `${serviceItem.code}-${String(countResult.count + 1).padStart(3, '0')}`;
  const id = uuidv4();

  let userId = null;
  if (appointment_id) {
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id) as any;
    if (appointment) {
      userId = appointment.user_id;
    }
  }

  db.prepare(`
    INSERT INTO tickets (id, ticket_number, service_item_id, user_id, appointment_id, status, applicant_name, applicant_phone)
    VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)
  `).run(id, ticketNumber, service_item_id, userId, appointment_id || null, 
        applicant_name || '现场群众', applicant_phone || null);

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  if (appointment_id) {
    db.prepare("UPDATE appointments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(appointment_id);
  }

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '现场取号', '叫号办理', ?)
  `).run(req.user!.id, req.user!.name, `现场取号${ticketNumber}，事项：${serviceItem.name}`);

  res.status(201).json({ ticket });
});

// 呼叫下一位
router.post('/:id/call', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { window_id } = req.body;
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
  
  if (!ticket) {
    return res.status(404).json({ message: '号票不存在' });
  }

  if (ticket.status !== 'waiting') {
    return res.status(400).json({ message: '该号票状态不支持呼叫' });
  }

  db.prepare(`
    UPDATE tickets SET status = 'calling', window_id = ?, call_count = call_count + 1, called_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(window_id || null, id);

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '呼叫号票', '叫号办理', ?)
  `).run(req.user!.id, req.user!.name, `呼叫号票${ticket.ticket_number}`);

  res.json({ ticket: updated });
});

// 开始办理
router.post('/:id/start', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
  
  if (!ticket) {
    return res.status(404).json({ message: '号票不存在' });
  }

  if (ticket.status !== 'calling') {
    return res.status(400).json({ message: '请先呼叫该号票' });
  }

  db.prepare("UPDATE tickets SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id);

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '开始办理', '叫号办理', ?)
  `).run(req.user!.id, req.user!.name, `开始办理号票${ticket.ticket_number}`);

  res.json({ ticket: updated });
});

// 完成办理
router.post('/:id/complete', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
  
  if (!ticket) {
    return res.status(404).json({ message: '号票不存在' });
  }

  if (ticket.status !== 'processing') {
    return res.status(400).json({ message: '该号票不在办理中' });
  }

  db.prepare("UPDATE tickets SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id);

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '完成办理', '叫号办理', ?)
  `).run(req.user!.id, req.user!.name, `完成办理号票${ticket.ticket_number}`);

  res.json({ ticket: updated });
});

// 过号/取消
router.post('/:id/cancel', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
  
  if (!ticket) {
    return res.status(404).json({ message: '号票不存在' });
  }

  db.prepare("UPDATE tickets SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id);

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '过号取消', '叫号办理', ?)
  `).run(req.user!.id, req.user!.name, `过号取消号票${ticket.ticket_number}`);

  res.json({ ticket: updated });
});

// 获取叫号统计
router.get('/stats/today', (req: AuthRequest, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM tickets 
    WHERE DATE(created_at) = ?
    GROUP BY status
  `).all(today);

  const result: any = {
    waiting: 0,
    calling: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    total: 0
  };

  stats.forEach((s: any) => {
    result[s.status] = s.count;
    result.total += s.count;
  });

  res.json({ stats: result });
});

export default router;
