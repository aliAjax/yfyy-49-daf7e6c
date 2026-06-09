import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);

// 预约日历看板聚合（管理员/窗口）
router.get('/board/summary', requireRoles('admin', 'window'), (req: AuthRequest, res) => {
  const { department_id, service_item_id } = req.query as any;
  const startDate = dayjs().format('YYYY-MM-DD');
  const endDate = dayjs().add(29, 'day').format('YYYY-MM-DD');

  let sourceSql = `
    SELECT ns.date, ns.total_count, ns.booked_count,
      si.id as service_item_id, si.name as service_item_name, si.code as service_item_code,
      si.department_id, d.name as department_name
    FROM number_sources ns
    LEFT JOIN service_items si ON ns.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    WHERE ns.date >= ? AND ns.date <= ?
  `;
  const sourceParams: any[] = [startDate, endDate];

  let apptSql = `
    SELECT a.*, si.name as service_item_name, si.code as service_item_code,
      si.department_id, d.name as department_name, u.name as user_name, u.phone as user_phone
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.appointment_date >= ? AND a.appointment_date <= ?
  `;
  const apptParams: any[] = [startDate, endDate];

  if (req.user!.role === 'window') {
    if (req.user!.department_id) {
      sourceSql += ' AND si.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
      sourceParams.push(req.user!.department_id);
      apptSql += ' AND si.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
      apptParams.push(req.user!.department_id);
    } else {
      sourceSql += ' AND 1=0';
      apptSql += ' AND 1=0';
    }
  } else if (department_id) {
    sourceSql += ' AND si.department_id = ?';
    sourceParams.push(department_id);
    apptSql += ' AND si.department_id = ?';
    apptParams.push(department_id);
  }

  if (service_item_id) {
    sourceSql += ' AND ns.service_item_id = ?';
    sourceParams.push(service_item_id);
    apptSql += ' AND a.service_item_id = ?';
    apptParams.push(service_item_id);
  }

  sourceSql += ' ORDER BY ns.date ASC, si.sort_order ASC, si.created_at DESC';
  apptSql += ' ORDER BY a.appointment_date ASC, a.time_slot ASC, a.created_at ASC';

  const sources = db.prepare(sourceSql).all(...sourceParams) as any[];
  const appointments = db.prepare(apptSql).all(...apptParams) as any[];

  const apptsByDate = appointments.reduce<Record<string, any[]>>((acc, appointment) => {
    if (!acc[appointment.appointment_date]) {
      acc[appointment.appointment_date] = [];
    }
    acc[appointment.appointment_date].push(appointment);
    return acc;
  }, {});

  const sourceGroups = sources.reduce<Record<string, any>>((acc, source) => {
    if (!acc[source.date]) {
      acc[source.date] = {
        date: source.date,
        total_count: 0,
        booked_count: 0,
        remaining_count: 0,
        service_items: [],
      };
    }

    acc[source.date].total_count += source.total_count || 0;
    acc[source.date].booked_count += source.booked_count || 0;
    acc[source.date].remaining_count += (source.total_count || 0) - (source.booked_count || 0);
    acc[source.date].service_items.push({
      service_item_id: source.service_item_id,
      service_item_name: source.service_item_name,
      service_item_code: source.service_item_code,
      department_id: source.department_id,
      department_name: source.department_name,
      total_count: source.total_count || 0,
      booked_count: source.booked_count || 0,
      remaining_count: (source.total_count || 0) - (source.booked_count || 0),
    });

    return acc;
  }, {});

  const days = Array.from({ length: 30 }).map((_, index) => {
    const date = dayjs(startDate).add(index, 'day').format('YYYY-MM-DD');
    const sourceGroup = sourceGroups[date] || {
      date,
      total_count: 0,
      booked_count: 0,
      remaining_count: 0,
      service_items: [],
    };
    const dayAppointments = apptsByDate[date] || [];

    return {
      ...sourceGroup,
      appointment_count: dayAppointments.length,
      appointments: dayAppointments,
    };
  });

  const summary = days.reduce(
    (acc, day) => {
      acc.total_count += day.total_count;
      acc.booked_count += day.booked_count;
      acc.remaining_count += day.remaining_count;
      acc.appointment_count += day.appointment_count;
      return acc;
    },
    { total_count: 0, booked_count: 0, remaining_count: 0, appointment_count: 0 }
  );

  res.json({
    start_date: startDate,
    end_date: endDate,
    summary,
    days,
  });
});

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
  const { status, service_item_id, date, start_date, end_date, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT a.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, u.name as user_name, u.phone as user_phone
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'window') {
    if (req.user!.department_id) {
      sql += ' AND si.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
      params.push(req.user!.department_id);
    } else {
      sql += ' AND 1=0';
    }
  } else if (req.user!.role === 'approver' && req.user!.department_id) {
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
  } else {
    if (start_date) {
      sql += ' AND a.appointment_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND a.appointment_date <= ?';
      params.push(end_date);
    }
  }
  if (keyword) {
    sql += ' AND (a.applicant_name LIKE ? OR u.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT a.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, u.name as user_name, u.phone as user_phone',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const appointments = db.prepare(sql).all(...params);

  res.json({ appointments, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 预约签到取号（管理员/窗口）
router.post('/:id/check-in', requireRoles('admin', 'window'), (req: AuthRequest, res) => {
  const { id } = req.params;

  const appointment = db.prepare(`
    SELECT a.*, si.name as service_item_name, si.code as service_item_code
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    WHERE a.id = ?
  `).get(id) as any;

  if (!appointment) {
    return res.status(404).json({ message: '预约不存在' });
  }

  if (req.user!.role === 'window' && req.user!.department_id) {
    const allowed = db.prepare(`
      SELECT 1
      FROM service_items si
      LEFT JOIN windows w ON si.window_id = w.id
      WHERE si.id = ? AND w.department_id = ?
    `).get(appointment.service_item_id, req.user!.department_id);

    if (!allowed) {
      return res.status(403).json({ message: '无权为该预约取号' });
    }
  }

  if (appointment.status === 'cancelled') {
    return res.status(400).json({ message: '该预约已取消，无法取号' });
  }

  const existingTicket = db.prepare('SELECT * FROM tickets WHERE appointment_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(id) as any;

  if (appointment.status === 'completed' && existingTicket) {
    return res.json({ ticket: existingTicket, is_idempotent: true });
  }

  if (appointment.status === 'completed' && !existingTicket) {
    return res.status(400).json({ message: '该预约已完成但未找到号票，请联系管理员核查' });
  }

  if (appointment.status !== 'confirmed') {
    return res.status(400).json({ message: '仅已确认预约可以签到取号' });
  }

  if (dayjs(appointment.appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))) {
    return res.status(400).json({ message: '该预约已过期，无法取号' });
  }

  if (!appointment.service_item_code || !appointment.service_item_name) {
    return res.status(400).json({ message: '预约关联事项不存在，无法取号' });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const idempotentError = new Error('DUPLICATE_TICKET');
  const ticketId = uuidv4();

  try {
    const tx = db.transaction(() => {
      const duplicateTicket = db.prepare('SELECT id FROM tickets WHERE appointment_id = ? LIMIT 1').get(id);
      if (duplicateTicket) {
        throw idempotentError;
      }

      const countResult = db.prepare(
        'SELECT COUNT(*) as count FROM tickets WHERE service_item_id = ? AND DATE(created_at) = ?'
      ).get(appointment.service_item_id, today) as any;
      const ticketNumber = `${appointment.service_item_code}-${String(countResult.count + 1).padStart(3, '0')}`;

      db.prepare(`
        INSERT INTO tickets (id, ticket_number, service_item_id, user_id, appointment_id, status, applicant_name, applicant_phone)
        VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)
      `).run(
        ticketId,
        ticketNumber,
        appointment.service_item_id,
        appointment.user_id,
        id,
        appointment.applicant_name || appointment.user_name || '预约群众',
        appointment.applicant_phone || appointment.user_phone || null
      );

      const updateResult = db.prepare(`
        UPDATE appointments
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'confirmed'
      `).run(id);

      if (updateResult.changes !== 1) {
        throw idempotentError;
      }
    });

    tx();
  } catch (error) {
    if (error === idempotentError || (error as Error).message === 'DUPLICATE_TICKET') {
      const existing = db.prepare('SELECT * FROM tickets WHERE appointment_id = ? ORDER BY created_at ASC LIMIT 1')
        .get(id) as any;
      if (existing) {
        return res.json({ ticket: existing, is_idempotent: true });
      }
    }
    throw error;
  }

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, related_id)
    VALUES (?, ?, 'appointment', '预约签到取号成功', ?, ?)
  `).run(
    uuidv4(),
    appointment.user_id,
    `您的${appointment.service_item_name}预约已签到取号，号票：${ticket.ticket_number}`,
    id
  );

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '预约签到取号', '预约', ?)
  `).run(
    req.user!.id,
    req.user!.name,
    `预约签到取号${ticket.ticket_number}，事项：${appointment.service_item_name}`
  );

  res.status(201).json({ ticket, is_idempotent: false });
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

  const serviceItem = db.prepare('SELECT name FROM service_items WHERE id = ?')
    .get(appointment.service_item_id) as any;

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '取消预约', '预约', ?)
  `).run(
    req.user!.id,
    req.user!.name,
    `取消预约${serviceItem?.name || appointment.service_item_id}，日期：${appointment.appointment_date}`
  );

  res.json({ message: '预约已取消' });
});

export default router;
