import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';
import type { CaseStatus } from '../types';

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

// 材料预审
router.post('/:id/material-review', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { material_id, status, review_comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?')
    .get(material_id, id);
  if (!material) {
    return res.status(404).json({ message: '材料不存在' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE case_materials 
      SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, review_comment || null, req.user!.id, material_id);

    const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(id);
    const allReviewed = allMaterials.every((m: any) => m.status !== 'pending');
    const hasRejected = allMaterials.some((m: any) => m.status === 'rejected');

    let caseStatus: CaseStatus = caseItem.status;
    if (allReviewed) {
      caseStatus = hasRejected ? 'material_correction' : 'accepting';
      db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(caseStatus, id);

      db.prepare(`
        INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
        VALUES (?, ?, ?, NULL, 'material_review', ?, ?)
      `).run(uuidv4(), id, req.user!.id, caseStatus, 
        hasRejected ? '材料审核不通过，需要补正' : '材料审核通过');
    }
  });

  tx();

  res.json({ message: '材料审核完成' });
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

// 添加材料
router.post('/:id/materials', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, type, file_url } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  const materialId = uuidv4();
  db.prepare(`
    INSERT INTO case_materials (id, case_id, name, type, file_url, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(materialId, id, name, type || null, file_url || null);

  const material = db.prepare('SELECT * FROM case_materials WHERE id = ?').get(materialId);
  res.status(201).json({ material });
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

export default router;
