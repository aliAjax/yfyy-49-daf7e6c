import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 获取我的评价
router.get('/my', (req: AuthRequest, res) => {
  const { page = 1, pageSize = 20 } = req.query as any;
  
  const sql = `
    SELECT e.*, c.case_number, si.name as service_item_name, d.name as department_name
    FROM evaluations e
    LEFT JOIN cases c ON e.case_id = c.id
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    WHERE e.user_id = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const evaluations = db.prepare(sql).all(req.user!.id, Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const total = db.prepare('SELECT COUNT(*) as count FROM evaluations WHERE user_id = ?')
    .get(req.user!.id) as any;

  res.json({ evaluations, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取评价列表（工作人员）
router.get('/', (req: AuthRequest, res) => {
  const { department_id, service_item_id, rating, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT e.*, c.case_number, si.name as service_item_name, d.name as department_name,
      u.name as user_name
    FROM evaluations e
    LEFT JOIN cases c ON e.case_id = c.id
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }

  if (department_id) {
    sql += ' AND c.department_id = ?';
    params.push(department_id);
  }
  if (service_item_id) {
    sql += ' AND c.service_item_id = ?';
    params.push(service_item_id);
  }
  if (rating) {
    sql += ' AND e.overall_rating = ?';
    params.push(Number(rating));
  }
  if (keyword) {
    sql += ' AND (c.case_number LIKE ? OR e.comment LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace(
    'SELECT e.*, c.case_number, si.name as service_item_name, d.name as department_name, u.name as user_name',
    'SELECT COUNT(*) as count'
  )).get(...params) as any;

  sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const evaluations = db.prepare(sql).all(...params);

  res.json({ evaluations, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 获取办件的评价
router.get('/case/:caseId', (req: AuthRequest, res) => {
  const { caseId } = req.params;
  
  const evaluation = db.prepare(`
    SELECT e.*, c.case_number, si.name as service_item_name
    FROM evaluations e
    LEFT JOIN cases c ON e.case_id = c.id
    LEFT JOIN service_items si ON c.service_item_id = si.id
    WHERE e.case_id = ?
  `).get(caseId);

  res.json({ evaluation });
});

// 提交评价
router.post('/', (req: AuthRequest, res) => {
  const { case_id, overall_rating, service_attitude_rating, processing_speed_rating, 
          material_requirement_rating, comment, suggestions } = req.body;
  
  if (!case_id || !overall_rating) {
    return res.status(400).json({ message: '请填写评价信息' });
  }

  const caseItem = db.prepare('SELECT * FROM cases WHERE id = ?').get(case_id) as any;
  if (!caseItem) {
    return res.status(404).json({ message: '办件不存在' });
  }

  if (caseItem.user_id !== req.user!.id && req.user!.role === 'citizen') {
    return res.status(403).json({ message: '无权评价此办件' });
  }

  if (caseItem.status !== 'completed') {
    return res.status(400).json({ message: '仅已办结的办件可以评价' });
  }

  const existing = db.prepare('SELECT id FROM evaluations WHERE case_id = ?').get(case_id);
  if (existing) {
    return res.status(400).json({ message: '您已评价过此办件' });
  }

  const id = uuidv4();
  const isSatisfied = overall_rating >= 4 ? 1 : 0;

  db.prepare(`
    INSERT INTO evaluations (id, case_id, user_id, overall_rating, service_attitude_rating, 
      processing_speed_rating, material_requirement_rating, comment, suggestions, is_satisfied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, case_id, req.user!.id, overall_rating, service_attitude_rating || null,
        processing_speed_rating || null, material_requirement_rating || null, 
        comment || null, suggestions || null, isSatisfied);

  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (user_id, user_name, action, module, detail)
    VALUES (?, ?, '提交评价', '评价', ?)
  `).run(req.user!.id, req.user!.name, `评价办件${caseItem.case_number}，评分：${overall_rating}分`);

  res.status(201).json({ evaluation });
});

// 评价统计
router.get('/stats/summary', (req: AuthRequest, res) => {
  const { department_id, service_item_id, start_date, end_date } = req.query as any;
  
  let sql = 'SELECT * FROM evaluations e LEFT JOIN cases c ON e.case_id = c.id WHERE 1=1';
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    sql += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (department_id) {
    sql += ' AND c.department_id = ?';
    params.push(department_id);
  }
  if (service_item_id) {
    sql += ' AND c.service_item_id = ?';
    params.push(service_item_id);
  }
  if (start_date) {
    sql += ' AND DATE(e.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND DATE(e.created_at) <= ?';
    params.push(end_date);
  }

  const evaluations = db.prepare(sql).all(...params);
  
  const total = evaluations.length;
  const avgRating = total > 0 
    ? evaluations.reduce((sum: number, e: any) => sum + (e.overall_rating || 0), 0) / total
    : 0;
  const satisfiedCount = evaluations.filter((e: any) => e.is_satisfied === 1).length;
  const satisfactionRate = total > 0 ? (satisfiedCount / total * 100).toFixed(2) : '0';

  const ratingDistribution: any = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  evaluations.forEach((e: any) => {
    if (e.overall_rating >= 1 && e.overall_rating <= 5) {
      ratingDistribution[Math.floor(e.overall_rating)]++;
    }
  });

  res.json({
    stats: {
      total,
      avg_rating: Number(avgRating.toFixed(2)),
      satisfaction_rate: Number(satisfactionRate),
      satisfied_count: satisfiedCount,
      rating_distribution: ratingDistribution
    }
  });
});

export default router;
