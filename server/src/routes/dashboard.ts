import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles('admin', 'window', 'approver'));

function applyCaseScope(req: AuthRequest, where: string, params: any[], alias = 'c') {
  const prefix = alias ? `${alias}.` : '';

  if (req.user!.role === 'approver' && req.user!.department_id) {
    return {
      where: `${where} AND ${prefix}department_id = ?`,
      params: [...params, req.user!.department_id],
    };
  }

  if (req.user!.role === 'window') {
    if (!req.user!.department_id) {
      return { where: `${where} AND 1=0`, params };
    }

    return {
      where: `${where} AND ${prefix}window_id IN (SELECT id FROM windows WHERE department_id = ?)`,
      params: [...params, req.user!.department_id],
    };
  }

  return { where, params };
}

router.get('/stats', (req: AuthRequest, res) => {
  const { department_id } = req.query as any;
  
  let caseWhere = 'WHERE 1=1';
  const params: any[] = [];

  const scopedCases = applyCaseScope(req, caseWhere, params);
  caseWhere = scopedCases.where;
  params.push(...scopedCases.params);

  if (department_id && req.user!.role === 'admin') {
    caseWhere += ' AND c.department_id = ?';
    params.push(department_id);
  }

  const totalResult = db.prepare(
    `SELECT COUNT(*) as count FROM cases c ${caseWhere}`
  ).get(...params) as any;

  const today = dayjs().format('YYYY-MM-DD');
  const todayResult = db.prepare(
    `SELECT COUNT(*) as count FROM cases c ${caseWhere} AND DATE(c.created_at) = ?`
  ).get(...params, today) as any;

  const processingStatuses = ['submitted', 'material_reviewing', 'material_correction', 'accepting', 'reviewing', 'cross_department'];
  const processingResult = db.prepare(
    `SELECT COUNT(*) as count FROM cases c ${caseWhere} AND c.status IN (${processingStatuses.map(() => '?').join(',')})`
  ).get(...params, ...processingStatuses) as any;

  const completedResult = db.prepare(
    `SELECT COUNT(*) as count FROM cases c ${caseWhere} AND c.status = 'completed'`
  ).get(...params) as any;

  let evalWhere = 'WHERE 1=1';
  const evalParams: any[] = [];
  
  const scopedEvaluations = applyCaseScope(req, evalWhere, evalParams);
  evalWhere = scopedEvaluations.where;
  evalParams.push(...scopedEvaluations.params);

  if (department_id && req.user!.role === 'admin') {
    evalWhere += ' AND c.department_id = ?';
    evalParams.push(department_id);
  }

  const evalResult = db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(e.overall_rating) as avg_rating,
      SUM(CASE WHEN e.is_satisfied = 1 THEN 1 ELSE 0 END) as satisfied_count
    FROM evaluations e
    LEFT JOIN cases c ON e.case_id = c.id
    ${evalWhere}
  `).get(...evalParams) as any;

  const stats = {
    total_cases: totalResult.count || 0,
    today_cases: todayResult.count || 0,
    processing_cases: processingResult.count || 0,
    completed_cases: completedResult.count || 0,
    avg_rating: evalResult.avg_rating ? Number(evalResult.avg_rating.toFixed(2)) : 0,
    satisfaction_rate: evalResult.total > 0 
      ? Number(((evalResult.satisfied_count / evalResult.total) * 100).toFixed(2))
      : 0,
    total_evaluations: evalResult.total || 0,
  };

  res.json(stats);
});

router.get('/trend', (req: AuthRequest, res) => {
  const { department_id, days = 30 } = req.query as any;
  
  const dayCount = Number(days);
  const dates: string[] = [];
  const counts: number[] = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    dates.push(date);
    
    let sql = 'SELECT COUNT(*) as count FROM cases WHERE DATE(created_at) = ?';
    const params: any[] = [date];

    const scoped = applyCaseScope(req, sql, params, '');
    sql = scoped.where;
    params.splice(0, params.length, ...scoped.params);

    if (department_id && req.user!.role === 'admin') {
      sql += ' AND department_id = ?';
      params.push(department_id);
    }

    const result = db.prepare(sql).get(...params) as any;
    counts.push(result.count || 0);
  }

  const formattedDates = dates.map(d => dayjs(d).format('MM-DD'));

  res.json({ dates: formattedDates, counts });
});

router.get('/department-stats', (req: AuthRequest, res) => {
  const { start_date, end_date } = req.query as any;
  
  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    where += ' AND d.id = ?';
    params.push(req.user!.department_id);
  }
  if (req.user!.role === 'window') {
    if (req.user!.department_id) {
      where += ' AND c.window_id IN (SELECT id FROM windows WHERE department_id = ?)';
      params.push(req.user!.department_id);
    } else {
      where += ' AND 1=0';
    }
  }
  if (start_date) {
    where += ' AND DATE(c.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND DATE(c.created_at) <= ?';
    params.push(end_date);
  }

  const stats = db.prepare(`
    SELECT 
      d.id,
      d.name,
      COUNT(c.id) as count
    FROM departments d
    LEFT JOIN cases c ON d.id = c.department_id
    ${where}
    GROUP BY d.id, d.name
    ORDER BY count DESC
  `).all(...params);

  const names = stats.map((s: any) => s.name);
  const counts = stats.map((s: any) => s.count);

  res.json({ names, counts, departments: stats });
});

router.get('/recent-cases', (req: AuthRequest, res) => {
  const { limit = 10 } = req.query as any;
  
  let where = 'WHERE 1=1';
  const params: any[] = [];

  const scopedCases = applyCaseScope(req, where, params);
  where = scopedCases.where;
  params.push(...scopedCases.params);

  const cases = db.prepare(`
    SELECT 
      c.id,
      c.case_number,
      c.service_item_id,
      c.status,
      c.applicant_name,
      c.created_at,
      si.name as service_item_name,
      d.name as department_name
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(...params, Number(limit));

  res.json({ cases });
});

router.get('/quick-stats', (req: AuthRequest, res) => {
  const { department_id } = req.query as any;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  const scopedCases = applyCaseScope(req, where, params, '');
  where = scopedCases.where;
  params.push(...scopedCases.params);

  if (department_id && req.user!.role === 'admin') {
    where += ' AND department_id = ?';
    params.push(department_id);
  }

  const statusStats = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM cases 
    ${where}
    GROUP BY status
  `).all(...params);

  const today = dayjs().format('YYYY-MM-DD');
  const todayAppts = db.prepare(`
    SELECT COUNT(*) as count 
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    WHERE a.appointment_date = ?
    ${req.user!.role === 'approver' && req.user!.department_id ? 'AND si.department_id = ?' : ''}
    ${req.user!.role === 'window' && req.user!.department_id ? 'AND si.window_id IN (SELECT id FROM windows WHERE department_id = ?)' : ''}
    ${req.user!.role === 'window' && !req.user!.department_id ? 'AND 1=0' : ''}
  `).get(
    today,
    ...(req.user!.role === 'approver' && req.user!.department_id ? [req.user!.department_id] : []),
    ...(req.user!.role === 'window' && req.user!.department_id ? [req.user!.department_id] : [])
  ) as any;

  let overdueWhere = `WHERE c.deadline IS NOT NULL 
      AND c.deadline < datetime('now')
      AND c.status NOT IN ('completed', 'rejected')`;
  const overdueParams: any[] = [];
  const scopedOverdue = applyCaseScope(req, overdueWhere, overdueParams);
  overdueWhere = scopedOverdue.where;
  overdueParams.push(...scopedOverdue.params);

  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM cases c
    ${overdueWhere}
  `).get(...overdueParams) as any;

  res.json({
    status_stats: statusStats,
    today_appointments: todayAppts.count || 0,
    overdue_count: overdueCount.count || 0,
  });
});

export default router;
