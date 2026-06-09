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
    INSERT INTO notifications (id, user_id, type, sub_type, title, content, related_id)
    VALUES (?, ?, 'appointment', 'appointment_confirmed', '预约成功', ?, ?)
  `).run(uuidv4(), req.user!.id, `您已成功预约${serviceItem.name}，预约日期：${appointment_date}`, id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '创建预约', '预约', ?)
  `).run(req.user!.id, req.user!.name, `预约${serviceItem.name}，日期：${appointment_date}`);

  res.status(201).json({ appointment });
});

// 预约日历看板 - 获取未来N天的号源和预约数据
router.get('/calendar/overview', (req: AuthRequest, res) => {
  const { department_id, service_item_id, days = 30 } = req.query as any;

  const dayCount = Math.min(Math.max(Number(days), 1), 90);
  const today = dayjs().format('YYYY-MM-DD');
  const endDate = dayjs().add(dayCount - 1, 'day').format('YYYY-MM-DD');

  let sql = `
    SELECT
      ns.id,
      ns.service_item_id,
      si.name as service_item_name,
      si.code as service_item_code,
      d.id as department_id,
      d.name as department_name,
      ns.date,
      ns.total_count,
      ns.booked_count
    FROM number_sources ns
    LEFT JOIN service_items si ON ns.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    WHERE ns.date >= ? AND ns.date <= ?
  `;
  const params: any[] = [today, endDate];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  } else if (req.user!.role === 'window' && req.user!.department_id) {
    sql += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (department_id) {
    sql += ' AND si.department_id = ?';
    params.push(department_id);
  }
  if (service_item_id) {
    sql += ' AND ns.service_item_id = ?';
    params.push(service_item_id);
  }

  sql += ' ORDER BY ns.date ASC, si.department_id ASC, si.sort_order ASC';

  const sources = db.prepare(sql).all(...params);

  const dateMap: Record<string, any[]> = {};
  const serviceItemSet = new Set<string>();

  sources.forEach((item: any) => {
    const date = item.date;
    if (!dateMap[date]) {
      dateMap[date] = [];
    }
    dateMap[date].push(item);
    serviceItemSet.add(item.service_item_id);
  });

  const calendar: any[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
    const daySources = dateMap[date] || [];

    const dayTotal = daySources.reduce((sum, s) => sum + s.total_count, 0);
    const dayBooked = daySources.reduce((sum, s) => sum + s.booked_count, 0);

    calendar.push({
      date,
      total_count: dayTotal,
      booked_count: dayBooked,
      remaining_count: dayTotal - dayBooked,
      items: daySources.map(s => ({
        service_item_id: s.service_item_id,
        service_item_name: s.service_item_name,
        service_item_code: s.service_item_code,
        department_id: s.department_id,
        department_name: s.department_name,
        total_count: s.total_count,
        booked_count: s.booked_count,
        remaining_count: s.total_count - s.booked_count,
      })),
    });
  }

  const totalStats = sources.reduce(
    (acc: any, item: any) => {
      acc.total_count += item.total_count;
      acc.booked_count += item.booked_count;
      return acc;
    },
    { total_count: 0, booked_count: 0 }
  );

  res.json({
    calendar,
    stats: {
      total_count: totalStats.total_count,
      booked_count: totalStats.booked_count,
      remaining_count: totalStats.total_count - totalStats.booked_count,
      service_item_count: serviceItemSet.size,
      date_range: { start: today, end: endDate },
    },
  });
});

// 获取某天的预约名单
router.get('/calendar/day-appointments', (req: AuthRequest, res) => {
  const { date, department_id, service_item_id, status, page = 1, pageSize = 50 } = req.query as any;

  if (!date) {
    return res.status(400).json({ message: '请指定日期' });
  }

  let sql = `
    SELECT
      a.id,
      a.appointment_date,
      a.time_slot,
      a.status,
      a.applicant_name,
      a.applicant_phone,
      a.applicant_id_card,
      a.remark,
      a.created_at,
      a.service_item_id,
      si.name as service_item_name,
      si.code as service_item_code,
      d.id as department_id,
      d.name as department_name,
      u.name as user_name
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.appointment_date = ?
  `;
  const params: any[] = [date];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  } else if (req.user!.role === 'window' && req.user!.department_id) {
    sql += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (department_id) {
    sql += ' AND si.department_id = ?';
    params.push(department_id);
  }
  if (service_item_id) {
    sql += ' AND a.service_item_id = ?';
    params.push(service_item_id);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');
  const total = db.prepare(countSql).get(...params) as any;

  sql += ' ORDER BY si.sort_order ASC, a.time_slot ASC, a.created_at ASC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const appointments = db.prepare(sql).all(...params);

  res.json({
    appointments,
    total: total.count,
    page: Number(page),
    pageSize: Number(pageSize),
    date,
  });
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

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '取消预约', '预约', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `取消预约：${appointment.applicant_name}，日期：${appointment.appointment_date}`);

  res.json({ message: '预约已取消' });
});

export default router;
