import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';
import type { CaseStatus, CaseMaterialStatus } from '../types';

const router = Router();

router.use(authMiddleware);

function generateCaseNumber(serviceCode: string): string {
  const today = dayjs().format('YYYYMMDD');
  const countResult = db.prepare(
    "SELECT COUNT(*) as count FROM cases WHERE service_item_id IN (SELECT id FROM service_items WHERE code = ?) AND DATE(created_at) = ?"
  ).get(serviceCode, dayjs().format('YYYY-MM-DD')) as any;
  return `${serviceCode}${today}${String(countResult.count + 1).padStart(4, '0')}`;
}

// 获取我的办件（群众）
router.get('/my', (req: AuthRequest, res) => {
  const { status, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, w.name as window_name,
      u.name as handler_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.current_handler_id = u.id
    WHERE c.user_id = ?
  `;
  const params: any[] = [req.user!.id];

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (c.case_number LIKE ? OR si.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT c.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, w.name as window_name, u.name as handler_name',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  let cases = db.prepare(sql).all(...params);

  cases = cases.map((c: any) => {
    if (c.handler_name) {
      c.handler_name = c.handler_name.charAt(0) + '*'.repeat(c.handler_name.length - 1);
    }
    return c;
  });

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取办件列表（工作人员）
router.get('/', (req: AuthRequest, res) => {
  const { status, department_id, service_item_id, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, u.name as user_name, u.phone as user_phone,
      handler.name as handler_name,
      cf.id as collaboration_flow_id,
      cf.from_department_id as collaboration_from_department_id,
      collab_d.name as collaboration_from_department_name,
      cf.created_at as collaboration_time
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    LEFT JOIN case_flows cf ON cf.id = (
      SELECT id FROM case_flows 
      WHERE case_id = c.id AND action = 'receive' 
      ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN departments collab_d ON cf.from_department_id = collab_d.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (req.user!.role === 'window') {
    sql += ' AND c.window_id IN (SELECT id FROM windows WHERE status = ?)';
    params.push('open');
  }

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (department_id) {
    sql += ' AND c.department_id = ?';
    params.push(department_id);
  }
  if (service_item_id) {
    sql += ' AND c.service_item_id = ?';
    params.push(service_item_id);
  }
  if (keyword) {
    sql += ' AND (c.case_number LIKE ? OR c.applicant_name LIKE ? OR u.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT c.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, u.name as user_name, u.phone as user_phone, handler.name as handler_name, cf.id as collaboration_flow_id, cf.from_department_id as collaboration_from_department_id, collab_d.name as collaboration_from_department_name, cf.created_at as collaboration_time',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const cases = db.prepare(sql).all(...params);

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取办件详情
router.get('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const caseItem = db.prepare(`
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      si.description as service_item_description, si.materials as required_materials,
      d.name as department_name, w.name as window_name, w.number as window_number,
      u.name as user_name, u.phone as user_phone, u.id_card as user_id_card,
      handler.name as handler_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    WHERE c.id = ?
  `).get(id) as any;

  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (req.user!.role === 'citizen' && caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权查看此办件' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权查看其他科室的办件' });
  }

  const materials = db.prepare('SELECT * FROM case_materials WHERE case_id = ? ORDER BY created_at').all(id);
  let flows = db.prepare(`
    SELECT cf.*, from_d.name as from_department_name, to_d.name as to_department_name,
      from_u.name as from_user_name, to_u.name as to_user_name
    FROM case_flows cf
    LEFT JOIN departments from_d ON cf.from_department_id = from_d.id
    LEFT JOIN departments to_d ON cf.to_department_id = to_d.id
    LEFT JOIN users from_u ON cf.from_user_id = from_u.id
    LEFT JOIN users to_u ON cf.to_user_id = to_u.id
    WHERE cf.case_id = ?
    ORDER BY cf.created_at ASC
  `).all(id);

  const requiredMaterialList = db.prepare(`
    SELECT * FROM service_item_materials
    WHERE service_item_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(caseItem.service_item_id);

  caseItem.material_list = requiredMaterialList.length > 0 ? requiredMaterialList : null;

  if (req.user!.role === 'citizen') {
    delete caseItem.user_phone;
    delete caseItem.user_id_card;
    if (caseItem.applicant_phone) {
      caseItem.applicant_phone = caseItem.applicant_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    if (caseItem.handler_name) {
      caseItem.handler_name = caseItem.handler_name.charAt(0) + '*'.repeat(caseItem.handler_name.length - 1);
    }
    if (caseItem.user_name) {
      caseItem.user_name = caseItem.user_name.charAt(0) + '*'.repeat(caseItem.user_name.length - 1);
    }
    flows = flows.map((flow: any) => {
      if (flow.from_user_name) {
        flow.from_user_name = flow.from_user_name.charAt(0) + '*'.repeat(flow.from_user_name.length - 1);
      }
      if (flow.to_user_name) {
        flow.to_user_name = flow.to_user_name.charAt(0) + '*'.repeat(flow.to_user_name.length - 1);
      }
      return flow;
    });
  }

  res.json({ case: caseItem, materials, flows });
});

// 创建办件（现场受理）
router.post('/', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { service_item_id, ticket_id, applicant_name, applicant_phone, applicant_id_card, 
          application_data, materials, window_id } = req.body;
  
  if (!service_item_id) {
    return res.status(400).json({ message: '请选择服务事项' });
  }

  const serviceItem = db.prepare('SELECT * FROM service_items WHERE id = ?').get(service_item_id) as any;
  if (!serviceItem) {
    return res.status(400).json({ message: '服务事项不存在' });
  }

  let userId = null;
  if (ticket_id) {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket_id) as any;
    if (ticket) {
      userId = ticket.user_id;
    }
  }

  const caseNumber = generateCaseNumber(serviceItem.code);
  const id = uuidv4();
  const deadline = serviceItem.processing_time 
    ? dayjs().add(serviceItem.processing_time, 'day').format('YYYY-MM-DD HH:mm:ss')
    : null;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO cases (id, case_number, service_item_id, user_id, ticket_id, window_id, 
        department_id, status, applicant_name, applicant_phone, applicant_id_card, 
        application_data, materials, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?)
    `).run(id, caseNumber, service_item_id, userId, ticket_id || null, window_id || null,
          serviceItem.department_id, applicant_name || '现场群众', 
          applicant_phone || null, applicant_id_card || null,
          application_data ? JSON.stringify(application_data) : null,
          materials ? JSON.stringify(materials) : null, deadline);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, NULL, ?, ?, NULL, 'submit', 'submitted', '提交申请')
    `).run(uuidv4(), id, serviceItem.department_id, req.user!.id);

    if (ticket_id) {
      db.prepare("UPDATE tickets SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(ticket_id);
    }
  });

  tx();

  const caseItem = db.prepare(`
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      si.description as service_item_description, si.materials as required_materials,
      d.name as department_name, w.name as window_name, w.number as window_number,
      u.name as user_name, u.phone as user_phone,
      handler.name as handler_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    WHERE c.id = ?
  `).get(id);

  const requiredMaterialList = db.prepare(`
    SELECT * FROM service_item_materials
    WHERE service_item_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(caseItem.service_item_id);

  caseItem.material_list = requiredMaterialList.length > 0 ? requiredMaterialList : null;

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '创建办件', '办件', ?)
  `).run(req.user!.id, req.user!.name, `创建办件${caseNumber}`);

  res.status(201).json({ case: caseItem });
});

// 受理办件
router.post('/:id/accept', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (!['submitted', 'material_correction', 'accepting'].includes(caseItem.status)) {
    return res.status(400).json({ message: '当前状态不支持受理' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET status = 'reviewing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, ?, NULL, 'accept', 'reviewing', ?)
    `).run(uuidv4(), id, req.user!.id, comment || '已受理，进入审批环节');
  });

  tx();

  if (caseItem.user_id) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '办件已受理', ?, ?)
    `).run(uuidv4(), caseItem.user_id, `您的办件${caseItem.case_number}已受理`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '受理办件', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `受理办件：${caseItem.case_number}`);

  res.json({ message: '受理成功' });
});

// 审批通过
router.post('/:id/approve', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment, result } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'reviewing' && caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持审批' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权审批其他科室的办件' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET status = 'approved', current_handler_id = ?, result = ?, 
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, result || '审批通过', id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, ?, ?, NULL, 'approve', 'approved', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, caseItem.department_id, caseItem.department_id, req.user!.id, comment || '审批通过');
  });

  tx();

  if (caseItem.user_id) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '办件审批通过', ?, ?)
    `).run(uuidv4(), caseItem.user_id, `您的办件${caseItem.case_number}已审批通过`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '审批通过', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `审批通过办件：${caseItem.case_number}`);

  res.json({ message: '审批通过' });
});

// 审批驳回
router.post('/:id/reject', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'reviewing' && caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持驳回' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET status = 'rejected', current_handler_id = ?, result = ?,
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, comment || '审批驳回', id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, NULL, 'reject', 'rejected', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, req.user!.id, comment || '审批驳回');
  });

  tx();

  if (caseItem.user_id) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '办件被驳回', ?, ?)
    `).run(uuidv4(), caseItem.user_id, `您的办件${caseItem.case_number}被驳回：${comment || '审批驳回'}`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '审批驳回', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `审批驳回办件：${caseItem.case_number}，原因：${comment || '审批驳回'}`);

  res.json({ message: '已驳回' });
});

// 跨科室转交（增强版：支持转交科室或指定审批人）
router.post('/:id/transfer', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { to_department_id, to_user_id, comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'reviewing' && caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持转交' });
  }

  if (!to_department_id && !to_user_id) {
    return res.status(400).json({ message: '请选择目标科室或指定审批人' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权流转其他科室的办件' });
  }

  let targetDepartmentId = to_department_id;
  let targetUserId = to_user_id || null;

  if (to_user_id) {
    const toUser = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(to_user_id, 'approver') as any;
    if (!toUser) {
      return res.status(400).json({ message: '指定审批人不存在或不是审批角色' });
    }
    if (toUser.status !== 'active') {
      return res.status(400).json({ message: '指定审批人账号未激活' });
    }
    targetDepartmentId = toUser.department_id;
    targetUserId = toUser.id;
  }

  if (!targetDepartmentId) {
    return res.status(400).json({ message: '无法确定目标科室' });
  }

  if (targetDepartmentId === caseItem.department_id && !to_user_id) {
    return res.status(400).json({ message: '不能流转到同一科室' });
  }

  const toDept = db.prepare('SELECT * FROM departments WHERE id = ?').get(targetDepartmentId);
  if (!toDept) {
    return res.status(400).json({ message: '目标科室不存在' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET department_id = ?, status = 'cross_department', 
        current_handler_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetDepartmentId, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, ?, ?, ?, 'transfer', 'cross_department', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, caseItem.department_id, targetDepartmentId, 
      req.user!.id, targetUserId, comment || '跨科室转交');
  });

  tx();

  if (targetUserId) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '收到协同办件', ?, ?)
    `).run(uuidv4(), targetUserId, 
      `您收到一件协同办理的办件：${caseItem.case_number}`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '跨科室转交', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, 
    `办件${caseItem.case_number} 跨科室转交：${caseItem.department_id} → ${targetDepartmentId}${targetUserId ? `（指定人）` : ''}`);

  res.json({ message: '转交成功' });
});

// 接收协同办件
router.post('/:id/receive', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持接收' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权接收其他科室的办件' });
  }

  if (caseItem.current_handler_id && caseItem.current_handler_id !== req.user!.id) {
    return res.status(400).json({ message: '该办件已被其他人接收' });
  }

  const lastTransferFlow = db.prepare(`
    SELECT * FROM case_flows
    WHERE case_id = ? AND action = 'transfer'
    ORDER BY created_at DESC LIMIT 1
  `).get(id) as any;

  if (
    req.user!.role === 'approver' &&
    lastTransferFlow?.to_user_id &&
    lastTransferFlow.to_user_id !== req.user!.id
  ) {
    return res.status(403).json({ message: '该办件已指定其他审批人接收' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET current_handler_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, ?, ?, ?, 'receive', 'cross_department', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, caseItem.department_id, caseItem.department_id, 
      null, req.user!.id, comment || '已接收协同办件');
  });

  tx();

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '接收协同办件', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `接收办件：${caseItem.case_number}`);

  res.json({ message: '接收成功' });
});

// 退回协同办件
router.post('/:id/return', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持退回' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权退回其他科室的办件' });
  }

  if (caseItem.current_handler_id && caseItem.current_handler_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ message: '只有当前处理人可以退回' });
  }

  const lastTransferFlow = db.prepare(`
    SELECT * FROM case_flows 
    WHERE case_id = ? AND action = 'transfer' 
    ORDER BY created_at DESC LIMIT 1
  `).get(id) as any;

  if (!lastTransferFlow || !lastTransferFlow.from_department_id) {
    return res.status(400).json({ message: '找不到来源科室，无法退回' });
  }

  const sourceDepartmentId = lastTransferFlow.from_department_id;
  const sourceUserId = lastTransferFlow.from_user_id;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET department_id = ?, status = 'reviewing', 
        current_handler_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sourceDepartmentId, sourceUserId || null, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, ?, ?, ?, 'return', 'reviewing', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, caseItem.department_id, sourceDepartmentId, 
      req.user!.id, sourceUserId, comment || '协同退回');
  });

  tx();

  if (sourceUserId) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '协同办件已退回', ?, ?)
    `).run(uuidv4(), sourceUserId, 
      `办件${caseItem.case_number}已被退回`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '协同退回', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, 
    `办件${caseItem.case_number} 协同退回：${caseItem.department_id} → ${sourceDepartmentId}`);

  res.json({ message: '退回成功' });
});

// 协同办结
router.post('/:id/collaborate-complete', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment, result } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'cross_department') {
    return res.status(400).json({ message: '当前状态不支持协同办结' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权办结其他科室的办件' });
  }

  if (caseItem.current_handler_id && caseItem.current_handler_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ message: '只有当前处理人可以办结' });
  }

  const lastTransferFlow = db.prepare(`
    SELECT * FROM case_flows 
    WHERE case_id = ? AND action = 'transfer' 
    ORDER BY created_at DESC LIMIT 1
  `).get(id) as any;

  const sourceDepartmentId = lastTransferFlow?.from_department_id;
  const sourceUserId = lastTransferFlow?.from_user_id;

  const tx = db.transaction(() => {
    if (sourceDepartmentId) {
      db.prepare(`
        UPDATE cases SET department_id = ?, status = 'reviewing', 
          current_handler_id = ?, result = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sourceDepartmentId, sourceUserId || null, result || comment || '协同办结', id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
          from_user_id, to_user_id, action, status, comment, handled_at)
        VALUES (?, ?, ?, ?, ?, ?, 'collaborate_complete', 'reviewing', ?, CURRENT_TIMESTAMP)
      `).run(uuidv4(), id, caseItem.department_id, sourceDepartmentId, 
        req.user!.id, sourceUserId, comment || '协同办结');
    } else {
      db.prepare(`
        UPDATE cases SET status = 'approved', current_handler_id = ?, 
          result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user!.id, result || comment || '协同办结', id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
          from_user_id, to_user_id, action, status, comment, handled_at)
        VALUES (?, ?, ?, ?, ?, NULL, 'collaborate_complete', 'approved', ?, CURRENT_TIMESTAMP)
      `).run(uuidv4(), id, caseItem.department_id, caseItem.department_id, 
        req.user!.id, comment || '协同办结');
    }
  });

  tx();

  if (sourceUserId) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '协同办件已办结', ?, ?)
    `).run(uuidv4(), sourceUserId, 
      `办件${caseItem.case_number}协同办理完成`, id);
  }

  if (caseItem.user_id && !sourceDepartmentId) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '办件审批通过', ?, ?)
    `).run(uuidv4(), caseItem.user_id, `您的办件${caseItem.case_number}已审批通过`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '协同办结', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `协同办结办件：${caseItem.case_number}`);

  res.json({ message: '协同办结成功' });
});

// 协同待办列表（增强版，支持多维度筛选）
router.get('/collaboration/todo', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { keyword, type = 'all', page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, u.name as user_name, u.phone as user_phone,
      handler.name as handler_name,
      cf.from_department_id as from_department_id,
      from_d.name as from_department_name,
      cf.from_user_id as transfer_from_user_id,
      from_u.name as transfer_from_user_name,
      cf.comment as transfer_comment,
      cf.created_at as transfer_time
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    LEFT JOIN case_flows cf ON cf.id = (
      SELECT id FROM case_flows 
      WHERE case_id = c.id AND action = 'transfer' 
      ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN departments from_d ON cf.from_department_id = from_d.id
    LEFT JOIN users from_u ON cf.from_user_id = from_u.id
    WHERE c.status = 'cross_department'
  `;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id && type !== 'initiated') {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);

    sql += ` AND (
      c.current_handler_id IS NULL
      OR c.current_handler_id = ?
      OR cf.to_user_id = ?
    )`;
    params.push(req.user!.id, req.user!.id);
  }

  if (type === 'pending_receive') {
    sql += ' AND c.current_handler_id IS NULL';
    if (req.user!.role === 'approver') {
      sql += ' AND (cf.to_user_id IS NULL OR cf.to_user_id = ?)';
      params.push(req.user!.id);
    }
  } else if (type === 'mine') {
    sql += ' AND c.current_handler_id = ?';
    params.push(req.user!.id);
  } else if (type === 'initiated') {
    sql += ' AND cf.from_user_id = ?';
    params.push(req.user!.id);
  }

  if (keyword) {
    sql += ' AND (c.case_number LIKE ? OR c.applicant_name LIKE ? OR u.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT c.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, u.name as user_name, u.phone as user_phone, handler.name as handler_name, cf.from_department_id as from_department_id, from_d.name as from_department_name, cf.from_user_id as transfer_from_user_id, from_u.name as transfer_from_user_name, cf.comment as transfer_comment, cf.created_at as transfer_time',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const cases = db.prepare(sql).all(...params);

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 协同待办统计（各类型数量）
router.get('/collaboration/stats', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const deptId = req.user!.department_id;
  const isApprover = req.user!.role === 'approver';

  let baseSql = `
    FROM cases c
    LEFT JOIN case_flows cf ON cf.id = (
      SELECT id FROM case_flows 
      WHERE case_id = c.id AND action = 'transfer' 
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE c.status = 'cross_department'
  `;
  const visibilityCondition = isApprover && deptId ? ` AND c.department_id = ? AND (
    c.current_handler_id IS NULL
    OR c.current_handler_id = ?
    OR cf.to_user_id = ?
  )` : '';
  const visibilityParams = isApprover && deptId ? [deptId, userId, userId] : [];

  const pendingReceiveCondition = isApprover && deptId
    ? ' AND c.department_id = ? AND c.current_handler_id IS NULL AND (cf.to_user_id IS NULL OR cf.to_user_id = ?)'
    : ' AND c.current_handler_id IS NULL';
  const pendingReceiveParams = isApprover && deptId ? [deptId, userId] : [];

  const mineCondition = isApprover && deptId
    ? ' AND c.department_id = ? AND c.current_handler_id = ?'
    : ' AND c.current_handler_id = ?';
  const mineParams = isApprover && deptId ? [deptId, userId] : [userId];

  const total = db.prepare(`SELECT COUNT(*) as count ${baseSql} ${visibilityCondition}`).get(...visibilityParams) as any;

  const pendingReceive = db.prepare(
    `SELECT COUNT(*) as count ${baseSql} ${pendingReceiveCondition}`
  ).get(...pendingReceiveParams) as any;

  const mine = db.prepare(
    `SELECT COUNT(*) as count ${baseSql} ${mineCondition}`
  ).get(...mineParams) as any;

  const initiated = db.prepare(
    `SELECT COUNT(*) as count ${baseSql} AND cf.from_user_id = ?`
  ).get(userId) as any;

  res.json({
    total: total.count,
    pending_receive: pendingReceive.count,
    mine: mine.count,
    initiated: initiated.count,
  });
});

// 获取科室审批人员列表
router.get('/department/:department_id/approvers', requireRoles('approver', 'admin', 'window'), (req: AuthRequest, res) => {
  const { department_id } = req.params;
  
  const users = db.prepare(`
    SELECT id, name, username, department_id, role, status, avatar
    FROM users 
    WHERE department_id = ? AND role = 'approver' AND status = 'active'
    ORDER BY name
  `).all(department_id);

  res.json({ users });
});

// 添加材料（支持批量）
router.post('/:id/materials', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { materials, name, type, file_url, service_item_material_id, is_required } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (req.user!.role === 'citizen' && caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权操作此办件的材料' });
  }

  const tx = db.transaction(() => {
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        const materialId = uuidv4();
        db.prepare(`
          INSERT INTO case_materials (id, case_id, name, type, file_url, status, service_item_material_id, is_required)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          materialId, 
          id, 
          mat.name, 
          mat.type || null, 
          mat.file_url || null,
          mat.service_item_material_id || null,
          mat.is_required !== undefined ? (mat.is_required ? 1 : 0) : 1
        );
      }
    } else {
      const materialId = uuidv4();
      db.prepare(`
        INSERT INTO case_materials (id, case_id, name, type, file_url, status, service_item_material_id, is_required)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        materialId, 
        id, 
        name, 
        type || null, 
        file_url || null,
        service_item_material_id || null,
        is_required !== undefined ? (is_required ? 1 : 0) : 1
      );
    }
  });

  tx();

  const materialList = db.prepare('SELECT * FROM case_materials WHERE case_id = ? ORDER BY created_at').all(id);
  res.status(201).json({ materials: materialList });
});

// 提交材料补正
router.post('/:id/materials/:materialId/correct', requireRoles('citizen', 'admin'), (req: AuthRequest, res) => {
  const { id, materialId } = req.params;
  const { correction_comment, correction_file_url } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (req.user!.role === 'citizen' && caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权操作此办件的材料' });
  }

  const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?').get(materialId, id) as any;
  if (!material) {
    return res.status(404).json({ message: '材料不存在' });
  }

  if (!['rejected', 'correction_rejected', 'correction_pending'].includes(material.status)) {
    return res.status(400).json({ message: '当前材料状态不支持补正' });
  }

  if (!correction_comment && !correction_file_url) {
    return res.status(400).json({ message: '请提供补正说明或补正附件' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE case_materials 
      SET status = 'correction_submitted', 
          correction_comment = ?, 
          correction_file_url = ?, 
          correction_count = correction_count + 1,
          last_corrected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      correction_comment || null, 
      correction_file_url || null, 
      materialId
    );

    const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(id) as any[];
    const allCorrectionSubmitted = allMaterials.every((m: any) => 
      ['correction_submitted', 'approved', 'correction_approved'].includes(m.status)
    );
    const hasCorrectionSubmitted = allMaterials.some((m: any) => m.status === 'correction_submitted');

    if (hasCorrectionSubmitted && caseItem.status === 'material_correction') {
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('material_reviewing', id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
        VALUES (?, ?, ?, NULL, 'material_correction_submit', ?, ?)
      `).run(
        uuidv4(), 
        id, 
        req.user!.id, 
        'material_reviewing', 
        '提交材料补正，等待重新审核'
      );
    }
  });

  tx();

  const updatedMaterial = db.prepare('SELECT * FROM case_materials WHERE id = ?').get(materialId);
  res.json({ material: updatedMaterial });
});

// 批量提交材料补正
router.post('/:id/materials-correct', requireRoles('citizen', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { corrections } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (req.user!.role === 'citizen' && caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权操作此办件的材料' });
  }

  if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
    return res.status(400).json({ message: '请提供补正材料' });
  }

  const tx = db.transaction(() => {
    for (const corr of corrections) {
      const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?')
        .get(corr.material_id, id) as any;
      
      if (!material) continue;
      if (!['rejected', 'correction_rejected', 'correction_pending'].includes(material.status)) continue;
      if (!corr.correction_comment && !corr.correction_file_url) continue;

      db.prepare(`
        UPDATE case_materials 
        SET status = 'correction_submitted', 
            correction_comment = ?, 
            correction_file_url = ?, 
            correction_count = correction_count + 1,
            last_corrected_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        corr.correction_comment || null, 
        corr.correction_file_url || null, 
        corr.material_id
      );
    }

    const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(id) as any[];
    const hasCorrectionSubmitted = allMaterials.some((m: any) => m.status === 'correction_submitted');

    if (hasCorrectionSubmitted && caseItem.status === 'material_correction') {
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('material_reviewing', id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
        VALUES (?, ?, ?, NULL, 'material_correction_submit', ?, ?)
      `).run(
        uuidv4(), 
        id, 
        req.user!.id, 
        'material_reviewing', 
        '提交材料补正，等待重新审核'
      );
    }
  });

  tx();

  const materials = db.prepare('SELECT * FROM case_materials WHERE case_id = ? ORDER BY created_at').all(id);
  res.json({ materials });
});

// 材料审核（支持首次审核和二次补正审核）
router.post('/:id/material-review', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { material_id, status, review_comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?')
    .get(material_id, id) as any;
  if (!material) {
    return res.status(404).json({ message: '材料不存在' });
  }

  if (!['pending', 'correction_submitted'].includes(material.status)) {
    return res.status(400).json({ message: '当前材料状态不支持审核' });
  }

  if (status === 'rejected' && !review_comment?.trim()) {
    return res.status(400).json({ message: '驳回时必须填写审核意见' });
  }

  const isCorrectionReview = material.status === 'correction_submitted';
  const materialStatus: CaseMaterialStatus = status === 'approved' 
    ? (isCorrectionReview ? 'correction_approved' : 'approved')
    : (isCorrectionReview ? 'correction_rejected' : 'rejected');

  const tx = db.transaction(() => {
    if (isCorrectionReview) {
      db.prepare(`
        UPDATE case_materials 
        SET status = ?, 
            review_comment = ?, 
            reviewed_by = ?, 
            last_correction_reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(materialStatus, review_comment || null, req.user!.id, material_id);
    } else {
      db.prepare(`
        UPDATE case_materials 
        SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(materialStatus, review_comment || null, req.user!.id, material_id);
    }

    const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(id) as any[];
    const allReviewed = allMaterials.every((m: any) => 
      !['pending', 'correction_submitted'].includes(m.status)
    );
    const hasRejected = allMaterials.some((m: any) => 
      m.status === 'rejected' || m.status === 'correction_rejected'
    );
    const hasApproved = allMaterials.some((m: any) => 
      m.status === 'approved' || m.status === 'correction_approved'
    );

    let caseStatus: CaseStatus = caseItem.status;
    let flowAction = 'material_review';
    let flowComment = '';

    if (allReviewed) {
      if (hasRejected) {
        caseStatus = 'material_correction';
        flowComment = isCorrectionReview 
          ? '材料补正审核不通过，仍需补正' 
          : '材料审核不通过，需要补正';
      } else {
        caseStatus = 'accepting';
        flowComment = isCorrectionReview 
          ? '材料补正审核通过，进入受理环节' 
          : '材料审核通过';
      }
      
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(caseStatus, id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
      `).run(uuidv4(), id, req.user!.id, flowAction, caseStatus, flowComment);
    } else if (isCorrectionReview && hasRejected && hasApproved) {
      caseStatus = 'material_correction';
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(caseStatus, id);
    }
  });

  tx();

  const materials = db.prepare('SELECT * FROM case_materials WHERE case_id = ? ORDER BY created_at').all(id);
  res.json({ message: '材料审核完成', materials });
});

// 批量材料审核
router.post('/:id/materials-batch-review', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reviews } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ message: '请提供审核材料' });
  }

  for (const review of reviews) {
    if (review.status === 'rejected' && !review.review_comment?.trim()) {
      const material = db.prepare('SELECT name FROM case_materials WHERE id = ? AND case_id = ?')
        .get(review.material_id, id) as any;
      return res.status(400).json({ 
        message: `材料「${material?.name || review.material_id}」驳回时必须填写审核意见` 
      });
    }
  }

  const tx = db.transaction(() => {
    for (const review of reviews) {
      const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?')
        .get(review.material_id, id) as any;
      
      if (!material) continue;
      if (!['pending', 'correction_submitted'].includes(material.status)) continue;

      const isCorrectionReview = material.status === 'correction_submitted';
      const materialStatus: CaseMaterialStatus = review.status === 'approved' 
        ? (isCorrectionReview ? 'correction_approved' : 'approved')
        : (isCorrectionReview ? 'correction_rejected' : 'rejected');

      if (isCorrectionReview) {
        db.prepare(`
          UPDATE case_materials 
          SET status = ?, 
              review_comment = ?, 
              reviewed_by = ?, 
              last_correction_reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(materialStatus, review.review_comment || null, req.user!.id, review.material_id);
      } else {
        db.prepare(`
          UPDATE case_materials 
          SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(materialStatus, review.review_comment || null, req.user!.id, review.material_id);
      }
    }

    const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(id) as any[];
    const allReviewed = allMaterials.every((m: any) => 
      !['pending', 'correction_submitted'].includes(m.status)
    );
    const hasRejected = allMaterials.some((m: any) => 
      m.status === 'rejected' || m.status === 'correction_rejected'
    );

    if (allReviewed) {
      const caseStatus: CaseStatus = hasRejected ? 'material_correction' : 'accepting';
      const flowComment = hasRejected 
        ? '材料审核不通过，需要补正' 
        : '材料审核通过';
      
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(caseStatus, id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
        VALUES (?, ?, ?, NULL, 'material_review', ?, ?)
      `).run(uuidv4(), id, req.user!.id, caseStatus, flowComment);
    }
  });

  tx();

  const materials = db.prepare('SELECT * FROM case_materials WHERE case_id = ? ORDER BY created_at').all(id);
  res.json({ message: '批量审核完成', materials });
});

// 办结
router.post('/:id/complete', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status !== 'approved') {
    return res.status(400).json({ message: '仅审批通过的办件可以办结' });
  }

  db.prepare(`
    UPDATE cases SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  if (caseItem.ticket_id) {
    db.prepare("UPDATE tickets SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(caseItem.ticket_id);
  }

  if (caseItem.user_id) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, related_id)
      VALUES (?, ?, 'case', '办件已办结', ?, ?)
    `).run(uuidv4(), caseItem.user_id, `您的办件${caseItem.case_number}已办结，请评价`, id);
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '办结', '办件管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `办结办件：${caseItem.case_number}`);

  res.json({ message: '办结成功' });
});

// 超期预警列表
router.get('/warnings/overdue', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { department_id, days = 3 } = req.query as any;
  
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');
  
  let sql = `
    SELECT c.*, si.name as service_item_name, d.name as department_name,
      u.name as user_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.status IN ('reviewing', 'cross_department', 'material_reviewing')
      AND c.deadline IS NOT NULL
      AND c.deadline <= ?
  `;
  const params: any[] = [warningDate];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (department_id && req.user!.role === 'admin') {
    sql += ' AND c.department_id = ?';
    params.push(department_id);
  }

  sql += ' ORDER BY c.deadline ASC';
  const cases = db.prepare(sql).all(...params);

  res.json({ cases });
});

// 超期预警中心 - 预警列表（分页）
router.get('/warnings/list', requireRoles('approver', 'admin', 'window'), (req: AuthRequest, res) => {
  const { 
    warning_type = 'all', 
    department_id, 
    keyword, 
    page = 1, 
    pageSize = 20,
    days = 3
  } = req.query as any;
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');
  
  let sql = `
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, w.name as window_name,
      u.name as user_name, u.phone as user_phone,
      handler.name as handler_name, handler.id as handler_id
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    WHERE c.deadline IS NOT NULL
  `;
  const params: any[] = [];

  if (warning_type === 'overdue') {
    sql += ' AND c.deadline < ? AND c.status NOT IN (\'completed\', \'rejected\')';
    params.push(now);
  } else if (warning_type === 'upcoming') {
    sql += ' AND c.deadline >= ? AND c.deadline <= ? AND c.status NOT IN (\'completed\', \'rejected\')';
    params.push(now, warningDate);
  } else if (warning_type === 'completed_on_time') {
    sql += ' AND c.status = \'completed\' AND c.completed_at IS NOT NULL AND c.completed_at <= c.deadline';
  } else if (warning_type === 'completed_overdue') {
    sql += ' AND c.status = \'completed\' AND c.completed_at IS NOT NULL AND c.completed_at > c.deadline';
  } else {
    sql += ' AND c.status NOT IN (\'completed\', \'rejected\') AND c.deadline <= ?';
    params.push(warningDate);
  }

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (req.user!.role === 'window' && req.user!.department_id) {
    sql += ' AND c.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
    params.push(req.user!.department_id);
  }

  if (department_id && req.user!.role === 'admin') {
    sql += ' AND c.department_id = ?';
    params.push(department_id);
  }

  if (keyword) {
    sql += ' AND (c.case_number LIKE ? OR c.applicant_name LIKE ? OR si.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const totalSql = sql.replace(
    'SELECT c.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, w.name as window_name, u.name as user_name, u.phone as user_phone, handler.name as handler_name, handler.id as handler_id',
    'SELECT COUNT(*) as count'
  );
  const total = db.prepare(totalSql).get(...params) as any;

  sql += ' ORDER BY c.deadline ASC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  let cases = db.prepare(sql).all(...params);

  cases = cases.map((c: any) => {
    const deadline = dayjs(c.deadline);
    const nowTime = dayjs();
    const diffDays = deadline.diff(nowTime, 'day');
    const diffHours = deadline.diff(nowTime, 'hour');
    
    let warningLevel = 'normal';
    if (c.status === 'completed' || c.status === 'rejected') {
      warningLevel = c.completed_at && dayjs(c.completed_at) <= deadline ? 'on_time' : 'overdue_completed';
    } else if (diffDays < 0) {
      warningLevel = 'overdue';
    } else if (diffDays <= 1) {
      warningLevel = 'urgent';
    } else if (diffDays <= Number(days)) {
      warningLevel = 'warning';
    }
    
    return {
      ...c,
      days_remaining: diffDays,
      hours_remaining: diffHours,
      warning_level: warningLevel
    };
  });

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 超期预警中心 - 统计数据
router.get('/warnings/stats', requireRoles('approver', 'admin', 'window'), (req: AuthRequest, res) => {
  const { department_id, days = 3 } = req.query as any;
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');
  
  let baseSql = `FROM cases c WHERE c.deadline IS NOT NULL`;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    baseSql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (req.user!.role === 'window' && req.user!.department_id) {
    baseSql += ' AND c.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
    params.push(req.user!.department_id);
  }

  if (department_id && req.user!.role === 'admin') {
    baseSql += ' AND c.department_id = ?';
    params.push(department_id);
  }

  const overdueSql = `SELECT COUNT(*) as count ${baseSql} AND c.deadline < ? AND c.status NOT IN ('completed', 'rejected')`;
  const upcomingSql = `SELECT COUNT(*) as count ${baseSql} AND c.deadline >= ? AND c.deadline <= ? AND c.status NOT IN ('completed', 'rejected')`;
  const completedOnTimeSql = `SELECT COUNT(*) as count ${baseSql} AND c.status = 'completed' AND c.completed_at IS NOT NULL AND c.completed_at <= c.deadline`;
  const completedOverdueSql = `SELECT COUNT(*) as count ${baseSql} AND c.status = 'completed' AND c.completed_at IS NOT NULL AND c.completed_at > c.deadline`;

  const overdueResult = db.prepare(overdueSql).get(...params, now) as any;
  const upcomingResult = db.prepare(upcomingSql).get(...params, now, warningDate) as any;
  const completedOnTimeResult = db.prepare(completedOnTimeSql).get(...params) as any;
  const completedOverdueResult = db.prepare(completedOverdueSql).get(...params) as any;

  let deptStats: any[] = [];
  if (req.user!.role === 'admin' && !department_id) {
    const deptStatsSql = `
      SELECT 
        d.id as department_id,
        d.name as department_name,
        SUM(CASE WHEN c.deadline < ? AND c.status NOT IN ('completed', 'rejected') THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN c.deadline >= ? AND c.deadline <= ? AND c.status NOT IN ('completed', 'rejected') THEN 1 ELSE 0 END) as upcoming_count,
        SUM(CASE WHEN c.status = 'completed' AND c.completed_at IS NOT NULL AND c.completed_at <= c.deadline THEN 1 ELSE 0 END) as on_time_count,
        SUM(CASE WHEN c.status = 'completed' AND c.completed_at IS NOT NULL AND c.completed_at > c.deadline THEN 1 ELSE 0 END) as overdue_completed_count
      FROM departments d
      LEFT JOIN cases c ON c.department_id = d.id AND c.deadline IS NOT NULL
      GROUP BY d.id, d.name
      ORDER BY d.name
    `;
    deptStats = db.prepare(deptStatsSql).all(now, now, warningDate);
  }

  res.json({
    overdue: overdueResult.count,
    upcoming: upcomingResult.count,
    completed_on_time: completedOnTimeResult.count,
    completed_overdue: completedOverdueResult.count,
    total_warnings: overdueResult.count + upcomingResult.count,
    department_stats: deptStats
  });
});

// 超期预警中心 - 催办操作
router.post('/warnings/:id/remind', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { remark } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.status === 'completed' || caseItem.status === 'rejected') {
    return res.status(400).json({ message: '该办件已办结或已驳回，无需催办' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权催办其他科室的办件' });
  }

  const handler = caseItem.current_handler_id 
    ? db.prepare('SELECT * FROM users WHERE id = ?').get(caseItem.current_handler_id) as any
    : null;

  const tx = db.transaction(() => {
    if (handler) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, content, related_id)
        VALUES (?, ?, 'reminder', '办件催办通知', ?, ?)
      `).run(
        uuidv4(), 
        handler.id, 
        `您负责的办件${caseItem.case_number}即将到期，请尽快处理。${remark ? '催办备注：' + remark : ''}`, 
        id
      );
    }

    if (caseItem.department_id) {
      const deptApprovers = db.prepare(`
        SELECT id FROM users 
        WHERE department_id = ? AND role = 'approver' AND status = 'active' AND id != ?
      `).all(caseItem.department_id, handler?.id || '');
      
      for (const approver of deptApprovers as any[]) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, content, related_id)
          VALUES (?, ?, 'reminder', '办件催办通知', ?, ?)
        `).run(
          uuidv4(), 
          approver.id, 
          `科室办件${caseItem.case_number}即将到期，请关注处理进度。${remark ? '催办备注：' + remark : ''}`, 
          id
        );
      }
    }

    db.prepare(`
      INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
      VALUES (?, ?, ?, '催办', '超期预警', ?)
    `).run(
      uuidv4(), 
      req.user!.id, 
      req.user!.name, 
      `催办办件：${caseItem.case_number}${remark ? '，备注：' + remark : ''}`
    );
  });

  tx();

  res.json({ message: '催办通知已发送' });
});

export default router;
