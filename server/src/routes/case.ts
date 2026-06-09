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

function applyWarningScope(req: AuthRequest, sql: string, params: any[], departmentId?: string) {
  if (req.user!.role === 'approver') {
    if (!req.user!.department_id) {
      return `${sql} AND 1=0`;
    }
    params.push(req.user!.department_id);
    return `${sql} AND c.department_id = ?`;
  }

  if (req.user!.role === 'window') {
    if (!req.user!.department_id) {
      return `${sql} AND 1=0`;
    }
    params.push(req.user!.department_id, req.user!.department_id);
    return `${sql} AND (c.department_id = ? OR c.window_id IN (SELECT id FROM windows WHERE department_id = ?))`;
  }

  if (departmentId) {
    params.push(departmentId);
    return `${sql} AND c.department_id = ?`;
  }

  return sql;
}

function warningStatusSelect(now: string) {
  return `
    CASE
      WHEN c.status = 'completed' AND c.deadline IS NOT NULL
        AND COALESCE(c.completed_at, c.updated_at) <= c.deadline THEN 'on_time'
      WHEN c.deadline < '${now}' THEN 'overdue'
      ELSE 'upcoming'
    END as warning_status,
    CASE
      WHEN c.status = 'completed' THEN 0
      ELSE CAST((julianday(c.deadline) - julianday('${now}')) * 24 AS INTEGER)
    END as remaining_hours
  `;
}

function parseMaterialItems(input: any): any[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function materialName(item: any, index: number) {
  if (typeof item === 'string') return item;
  return item?.name || item?.material_name || `材料${index + 1}`;
}

function refreshCaseMaterialStatus(caseId: string, fallbackStatus: CaseStatus) {
  const allMaterials = db.prepare('SELECT status FROM case_materials WHERE case_id = ?').all(caseId) as any[];
  if (allMaterials.length === 0) return fallbackStatus;

  const hasRejected = allMaterials.some((m: any) => m.status === 'rejected');
  if (hasRejected) return 'material_correction';

  const hasPending = allMaterials.some((m: any) => m.status === 'pending');
  return hasPending ? 'material_reviewing' : 'accepting';
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

  const cases = db.prepare(sql).all(...params);

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取办件列表（工作人员）
router.get('/', (req: AuthRequest, res) => {
  const { status, department_id, service_item_id, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT c.*, si.name as service_item_name, si.code as service_item_code,
      d.name as department_name, u.name as user_name, u.phone as user_phone,
      handler.name as handler_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
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
    'SELECT c.*, si.name as service_item_name, si.code as service_item_code, d.name as department_name, u.name as user_name, u.phone as user_phone, handler.name as handler_name',
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
  const flows = db.prepare(`
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
    const materialItems = parseMaterialItems(materials);
    const initialStatus: CaseStatus = materialItems.length > 0 ? 'material_reviewing' : 'submitted';

    db.prepare(`
      INSERT INTO cases (id, case_number, service_item_id, user_id, ticket_id, window_id, 
        department_id, status, applicant_name, applicant_phone, applicant_id_card, 
        application_data, materials, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, caseNumber, service_item_id, userId, ticket_id || null, window_id || null,
          serviceItem.department_id, initialStatus, applicant_name || '现场群众',
          applicant_phone || null, applicant_id_card || null,
          application_data ? JSON.stringify(application_data) : null,
          materials ? JSON.stringify(materials) : null, deadline);

    materialItems.forEach((material, index) => {
      db.prepare(`
        INSERT INTO case_materials (id, case_id, name, type, file_url, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(
        uuidv4(),
        id,
        materialName(material, index),
        typeof material === 'object' ? material.type || null : null,
        typeof material === 'object' ? material.file_url || null : null
      );
    });

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, NULL, ?, ?, NULL, 'submit', ?, ?)
    `).run(
      uuidv4(),
      id,
      serviceItem.department_id,
      req.user!.id,
      initialStatus,
      materialItems.length > 0 ? '提交申请，进入材料审核' : '提交申请'
    );

    if (ticket_id) {
      db.prepare("UPDATE tickets SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(ticket_id);
    }
  });

  tx();

  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);

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

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: '材料审核状态不正确' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE case_materials 
      SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, review_comment || null, req.user!.id, material_id);

    const caseStatus = refreshCaseMaterialStatus(id, caseItem.status);
    db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(caseStatus, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, ?, NULL, 'material_review', ?, ?)
    `).run(
      uuidv4(),
      id,
      req.user!.id,
      caseStatus,
      status === 'rejected'
        ? `材料${(material as any).name}审核不通过：${review_comment || '需要补正'}`
        : `材料${(material as any).name}审核通过`
    );
  });

  tx();

  res.json({ message: '材料审核完成' });
});

// 批量材料预审
router.post('/:id/material-batch-review', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reviews } = req.body;

  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ message: '请选择待审核材料' });
  }

  const normalizedReviews = reviews.map((item: any) => ({
    material_id: item?.material_id,
    status: item?.status,
    review_comment: typeof item?.review_comment === 'string' ? item.review_comment.trim() : '',
  }));

  const materialIds = normalizedReviews.map((item) => item.material_id);
  if (materialIds.some((materialId) => !materialId)) {
    return res.status(400).json({ message: '材料审核数据不完整' });
  }

  if (new Set(materialIds).size !== materialIds.length) {
    return res.status(400).json({ message: '不能重复审核同一份材料' });
  }

  const invalidReview = normalizedReviews.find((item) => !['approved', 'rejected'].includes(item.status));
  if (invalidReview) {
    return res.status(400).json({ message: '材料审核状态不正确' });
  }

  const missingRejectComment = normalizedReviews.find(
    (item) => item.status === 'rejected' && !item.review_comment
  );
  if (missingRejectComment) {
    return res.status(400).json({ message: '驳回材料必须填写审核意见' });
  }

  const placeholders = materialIds.map(() => '?').join(',');
  const materials = db.prepare(`
    SELECT * FROM case_materials
    WHERE case_id = ? AND id IN (${placeholders})
  `).all(id, ...materialIds) as any[];

  if (materials.length !== materialIds.length) {
    return res.status(404).json({ message: '存在不属于当前办件的材料' });
  }

  const nonPendingMaterial = materials.find((material) => material.status !== 'pending');
  if (nonPendingMaterial) {
    return res.status(400).json({ message: '仅待审核材料可以批量审核' });
  }

  const materialMap = new Map(materials.map((material) => [material.id, material]));

  const tx = db.transaction(() => {
    normalizedReviews.forEach((item) => {
      db.prepare(`
        UPDATE case_materials
        SET status = ?, review_comment = ?, reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        item.status,
        item.review_comment || (item.status === 'approved' ? '材料审核通过' : null),
        req.user!.id,
        item.material_id
      );
    });

    const caseStatus = refreshCaseMaterialStatus(id, caseItem.status);
    db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(caseStatus, id);

    const summary = normalizedReviews.map((item) => {
      const material = materialMap.get(item.material_id) as any;
      if (item.status === 'rejected') {
        return `${material.name}不通过：${item.review_comment}`;
      }
      return `${material.name}通过${item.review_comment ? `：${item.review_comment}` : ''}`;
    }).join('；');

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, ?, NULL, 'material_batch_review', ?, ?)
    `).run(uuidv4(), id, req.user!.id, caseStatus, `批量审核材料：${summary}`);
  });

  tx();

  res.json({ message: '材料批量审核完成' });
});

// 提交补正材料
router.post('/:id/materials/:materialId/correction', requireRoles('citizen'), (req: AuthRequest, res) => {
  const { id, materialId } = req.params;
  const { correction_comment, file_url } = req.body;

  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }
  if (caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权补正此办件材料' });
  }
  if (caseItem.status !== 'material_correction') {
    return res.status(400).json({ message: '当前办件状态不支持材料补正' });
  }

  const material = db.prepare('SELECT * FROM case_materials WHERE id = ? AND case_id = ?')
    .get(materialId, id) as any;
  if (!material) {
    return res.status(404).json({ message: '材料不存在' });
  }
  if (material.status !== 'rejected') {
    return res.status(400).json({ message: '仅被驳回材料可以提交补正' });
  }
  if (!correction_comment && !file_url) {
    return res.status(400).json({ message: '请填写补正说明或附件地址' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE case_materials
      SET status = 'pending',
        file_url = COALESCE(?, file_url),
        correction_comment = ?,
        corrected_at = CURRENT_TIMESTAMP,
        correction_count = COALESCE(correction_count, 0) + 1,
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(file_url || null, correction_comment || null, materialId);

    const caseStatus = refreshCaseMaterialStatus(id, 'material_reviewing');
    db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(caseStatus, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, ?, NULL, 'material_correction_submit', ?, ?)
    `).run(
      uuidv4(),
      id,
      req.user!.id,
      caseStatus,
      `提交${material.name}补正材料${correction_comment ? `：${correction_comment}` : ''}`
    );
  });

  tx();

  const updated = db.prepare('SELECT * FROM case_materials WHERE id = ?').get(materialId);
  res.json({ message: '补正材料已提交', material: updated });
});

// 受理办件
router.post('/:id/accept', requireRoles('window', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (!['submitted', 'accepting'].includes(caseItem.status)) {
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

  res.json({ message: '已驳回' });
});

// 跨科室流转
router.post('/:id/transfer', requireRoles('approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { to_department_id, comment } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (!to_department_id) {
    return res.status(400).json({ message: '请选择目标科室' });
  }

  if (to_department_id === caseItem.department_id) {
    return res.status(400).json({ message: '不能流转到同一科室' });
  }

  const toDept = db.prepare('SELECT * FROM departments WHERE id = ?').get(to_department_id);
  if (!toDept) {
    return res.status(400).json({ message: '目标科室不存在' });
  }

  if (req.user!.role === 'approver' && req.user!.department_id && caseItem.department_id !== req.user!.department_id) {
    return res.status(403).json({ message: '无权流转其他科室的办件' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE cases SET department_id = ?, status = 'cross_department', 
        current_handler_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(to_department_id, id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_department_id, to_department_id, 
        from_user_id, to_user_id, action, status, comment, handled_at)
      VALUES (?, ?, ?, ?, ?, NULL, 'transfer', 'cross_department', ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), id, caseItem.department_id, to_department_id, req.user!.id, comment || '跨科室流转');
  });

  tx();

  res.json({ message: '流转成功' });
});

// 添加材料
router.post('/:id/materials', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, type, file_url } = req.body;
  
  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }
  if (req.user!.role === 'citizen' && caseItem.user_id !== req.user!.id) {
    return res.status(403).json({ message: '无权添加此办件材料' });
  }
  if (['completed', 'rejected'].includes(caseItem.status)) {
    return res.status(400).json({ message: '已结束办件不能添加材料' });
  }

  const materialId = uuidv4();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO case_materials (id, case_id, name, type, file_url, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(materialId, id, name, type || null, file_url || null);

    db.prepare('UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(refreshCaseMaterialStatus(id, 'material_reviewing'), id);

    db.prepare(`
      INSERT INTO case_flows (id, case_id, from_user_id, to_user_id, action, status, comment)
      VALUES (?, ?, ?, NULL, 'material_create', 'material_reviewing', ?)
    `).run(uuidv4(), id, req.user!.id, `新增材料${name}，进入材料审核`);
  });

  tx();

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

  res.json({ message: '办结成功' });
});

// 超期预警列表
router.get('/warnings/list', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const {
    department_id,
    warning_status,
    keyword,
    days = 3,
    page = 1,
    pageSize = 20,
  } = req.query as any;

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');
  const baseParams: any[] = [warningDate];

  let where = `
    WHERE c.deadline IS NOT NULL
      AND (
        (c.status NOT IN ('completed', 'rejected') AND c.deadline <= ?)
        OR (c.status = 'completed' AND COALESCE(c.completed_at, c.updated_at) <= c.deadline)
      )
  `;
  where = applyWarningScope(req, where, baseParams, department_id);

  if (warning_status === 'upcoming') {
    where += ` AND c.status NOT IN ('completed', 'rejected') AND c.deadline >= ? AND c.deadline <= ?`;
    baseParams.push(now, warningDate);
  } else if (warning_status === 'overdue') {
    where += ` AND c.status NOT IN ('completed', 'rejected') AND c.deadline < ?`;
    baseParams.push(now);
  } else if (warning_status === 'on_time') {
    where += ` AND c.status = 'completed' AND COALESCE(c.completed_at, c.updated_at) <= c.deadline`;
  } else {
    where += ` AND (c.status != 'rejected')`;
  }

  if (keyword) {
    where += ` AND (c.case_number LIKE ? OR c.applicant_name LIKE ? OR si.name LIKE ?)`;
    baseParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const fromSql = `
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    ${where}
  `;

  const total = db.prepare(`SELECT COUNT(*) as count ${fromSql}`).get(...baseParams) as any;

  const listParams = [...baseParams, Number(pageSize), (Number(page) - 1) * Number(pageSize)];
  const cases = db.prepare(`
    SELECT c.*, si.name as service_item_name, d.name as department_name,
      w.name as window_name, u.name as user_name, handler.name as handler_name,
      ${warningStatusSelect(now)}
    ${fromSql}
    ORDER BY
      CASE warning_status WHEN 'overdue' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
      c.deadline ASC
    LIMIT ? OFFSET ?
  `).all(...listParams);

  res.json({ cases, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/warnings/overdue', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { department_id, days = 3 } = req.query as any;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');
  const params: any[] = [warningDate];

  let where = `
    WHERE c.status NOT IN ('completed', 'rejected')
      AND c.deadline IS NOT NULL
      AND c.deadline <= ?
  `;
  where = applyWarningScope(req, where, params, department_id);

  const cases = db.prepare(`
    SELECT c.*, si.name as service_item_name, d.name as department_name,
      w.name as window_name, u.name as user_name, handler.name as handler_name,
      ${warningStatusSelect(now)}
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN users handler ON c.current_handler_id = handler.id
    ${where}
    ORDER BY c.deadline ASC
  `).all(...params);

  res.json({ cases });
});

// 超期预警统计
router.get('/warnings/stats', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { department_id, days = 3 } = req.query as any;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const warningDate = dayjs().add(Number(days), 'day').format('YYYY-MM-DD HH:mm:ss');

  const scopedParams: any[] = [];
  const scopedWhere = applyWarningScope(req, 'WHERE 1=1', scopedParams, department_id);

  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN c.status NOT IN ('completed', 'rejected')
        AND c.deadline IS NOT NULL
        AND c.deadline >= ?
        AND c.deadline <= ? THEN 1 ELSE 0 END) as upcoming,
      SUM(CASE WHEN c.status NOT IN ('completed', 'rejected')
        AND c.deadline IS NOT NULL
        AND c.deadline < ? THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN c.status = 'completed'
        AND c.deadline IS NOT NULL
        AND COALESCE(c.completed_at, c.updated_at) <= c.deadline THEN 1 ELSE 0 END) as on_time
    FROM cases c
    ${scopedWhere}
  `).get(now, warningDate, now, ...scopedParams) as any;

  res.json({
    upcoming: stats.upcoming || 0,
    overdue: stats.overdue || 0,
    on_time: stats.on_time || 0,
  });
});

// 催办预警
router.post('/warnings/:id/remind', requireRoles('window', 'approver', 'admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const caseItem = db.prepare(`
    SELECT c.*, si.name as service_item_name, d.name as department_name, w.name as window_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN windows w ON c.window_id = w.id
    WHERE c.id = ?
  `).get(id) as any;

  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }
  if (caseItem.status === 'completed' || caseItem.status === 'rejected') {
    return res.status(400).json({ message: '已结束办件无需催办' });
  }
  if (!caseItem.deadline) {
    return res.status(400).json({ message: '该办件未设置办理期限' });
  }

  const scopeParams: any[] = [];
  const scopeSql = applyWarningScope(req, 'WHERE c.id = ?', scopeParams, undefined);
  const scopedCase = db.prepare(`SELECT c.id FROM cases c ${scopeSql}`).get(id, ...scopeParams);
  if (!scopedCase && req.user!.role !== 'admin') {
    return res.status(403).json({ message: '无权催办此办件' });
  }

  const recipients = new Map<string, any>();
  if (caseItem.current_handler_id) {
    const handler = db.prepare("SELECT id, name FROM users WHERE id = ? AND status = 'active'")
      .get(caseItem.current_handler_id) as any;
    if (handler) recipients.set(handler.id, handler);
  }

  const workers = db.prepare(`
    SELECT DISTINCT u.id, u.name
    FROM users u
    WHERE u.status = 'active'
      AND u.role IN ('approver', 'window')
      AND (
        u.department_id = ?
        OR u.id IN (
          SELECT u2.id
          FROM users u2
          JOIN windows w2 ON u2.department_id = w2.department_id
          WHERE w2.id = ?
        )
      )
  `).all(caseItem.department_id, caseItem.window_id || '') as any[];
  workers.forEach((worker) => recipients.set(worker.id, worker));

  if (recipients.size === 0) {
    return res.status(400).json({ message: '未找到可接收催办的工作人员' });
  }

  const remindContent = content || `办件${caseItem.case_number}即将或已经超期，请尽快处理。`;
  const tx = db.transaction(() => {
    for (const recipient of recipients.values()) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, content, related_id)
        VALUES (?, ?, 'case', '办件催办提醒', ?, ?)
      `).run(uuidv4(), recipient.id, remindContent, caseItem.id);
    }

    db.prepare(`
      INSERT INTO operation_logs (user_id, user_name, action, module, detail)
      VALUES (?, ?, '催办办件', '超期预警', ?)
    `).run(req.user!.id, req.user!.name, `催办办件${caseItem.case_number}`);
  });

  tx();

  res.json({ message: '催办通知已发送', notified_count: recipients.size });
});

export default router;
