import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);

// 获取我的预约（群众）
router.get('/my', (req: AuthRequest, res) => {
  const { status, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT a.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    WHERE a.user_id = ?
  `;
  const params: any[] = [req.user!.id];

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  const total = db.prepare(sql.replace('SELECT a.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name', 
    'SELECT COUNT(*) as count')).get(...params) as any;

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const appointments = db.prepare(sql).all(...params);

  res.json({ appointments, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取预约列表（管理员/窗口）
router.get('/', (req: AuthRequest, res) => {
  const { status, service_item_id, date, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT a.*, si.name as service_item_name, si.code as service_item_code,
      u.name as user_name, u.phone as user_phone
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (service_item_id) {
    sql += ' AND a.service_item_id = ?';
    params.push(service_item_id);
  }
  if (date) {
    sql += ' AND a.appointment_date = ?';
    params.push(date);
  }
  if (keyword) {
    sql += ' AND (a.applicant_name LIKE ? OR u.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT a.*, si.name as service_item_name, si.code as service_item_code, u.name as user_name, u.phone as user_phone',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const appointments = db.prepare(sql).all(...params);

  res.json({ appointments, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取预约详情
router.get('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const appointment = db.prepare(`
    SELECT a.*, si.name as service_item_name, si.code as service_item_code,
      si.description as service_item_description, si.materials as required_materials,
      d.name as department_name, w.name as window_name, w.number as window_number,
      u.name as user_name, u.phone as user_phone, u.id_card as user_id_card
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN windows w ON si.window_id = w.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `).get(id) as any;

  if (!appointment) {
    return res.status(404).json({ message: '预约不存在' });
  }

  if (req.user!.role === 'citizen' && appointment.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权查看此预约' });
  }

  res.json({ appointment });
});

// 创建预约
router.post('/', (req: AuthRequest, res) => {
  const { service_item_id, appointment_date, time_slot, applicant_name, applicant_phone, applicant_id_card, remark } = req.body;
  
  if (!service_item_id || !appointment_date) {
    return res.status(400).json({ message: '请选择服务事项和预约日期' });
  }

  if (dayjs(appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))) {
    return res.status(400).json({ message: '不能预约过去的日期' });
  }

  const serviceItem = db.prepare('SELECT * FROM service_items WHERE id = ? AND status = ?')
    .get(service_item_id, 'active') as any;
  
  if (!serviceItem) {
    return res.status(400).json({ message: '服务事项不存在或已停用' });
  }

  const numberSource = db.prepare('SELECT * FROM number_sources WHERE service_item_id = ? AND date = ?')
    .get(service_item_id, appointment_date) as any;
  
  if (!numberSource) {
    return res.status(400).json({ message: '该日期暂无号源' });
  }

  if (numberSource.booked_count >= numberSource.total_count) {
    return res.status(400).json({ message: '该日期号源已满' });
  }

  const existingAppointment = db.prepare(`
    SELECT id FROM appointments 
    WHERE user_id = ? AND service_item_id = ? AND appointment_date = ? AND status IN ('pending', 'confirmed')
  `).get(req.user!.id, service_item_id, appointment_date);

  if (existingAppointment) {
    return res.status(400).json({ message: '您在该日期已预约过此事项' });
  }

  const id = uuidv4();
  
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO appointments (id, user_id, service_item_id, appointment_date, time_slot, status, 
        applicant_name, applicant_phone, applicant_id_card, remark)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)
    `).run(id, req.user!.id, service_item_id, appointment_date, time_slot || null,
      applicant_name || req.user!.name, applicant_phone || req.user!.phone || null, 
      applicant_id_card || req.user!.id_card || null, remark || null);

    db.prepare('UPDATE number_sources SET booked_count = booked_count + 1 WHERE id = ?')
      .run(numberSource.id);
  });

  tx();

  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, related_id)
    VALUES (?, ?, 'appointment', '预约成功', ?, ?)
  `).run(uuidv4(), req.user!.id, `您已成功预约${serviceItem.name}，预约日期：${appointment_date}`, id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '创建预约', '预约', ?)
  `).run(req.user!.id, req.user!.name, `预约${serviceItem.name}，日期：${appointment_date}`);

  res.status(201).json({ appointment });
});

// 取消预约
router.post('/:id/cancel', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  
  if (!appointment) {
    return res.status(404).json({ message: '预约不存在' });
  }

  if (req.user!.role === 'citizen' && appointment.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权取消此预约' });
  }

  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return res.status(400).json({ message: '该预约无法取消' });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);

    const numberSource = db.prepare(
      'SELECT id FROM number_sources WHERE service_item_id = ? AND date = ?'
    ).get(appointment.service_item_id, appointment.appointment_date) as any;

    if (numberSource) {
      db.prepare('UPDATE number_sources SET booked_count = MAX(0, booked_count - 1) WHERE id = ?')
        .run(numberSource.id);
    }
  });

  tx();

  res.json({ message: '预约已取消' });
});

export default router;
