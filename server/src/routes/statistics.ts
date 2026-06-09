import { Router } from 'express';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles('admin', 'approver'));

function conversionBaseWhere(req: AuthRequest, departmentId?: string) {
  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    where += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (departmentId) {
    where += ' AND si.department_id = ?';
    params.push(departmentId);
  }

  return { where, params };
}

function appointmentConversionSelect(groupSelect: string, groupBy: string, groupOrder: string) {
  return `
    SELECT
      ${groupSelect},
      COUNT(DISTINCT a.id) as appointment_count,
      COUNT(DISTINCT CASE WHEN t.id IS NOT NULL OR a.status = 'completed' THEN a.id END) as checked_in_count,
      COUNT(DISTINCT c.id) as case_count,
      COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_count,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT CASE WHEN t.id IS NOT NULL OR a.status = 'completed' THEN a.id END) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as check_in_rate,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT c.id) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as case_rate,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as completion_rate
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN tickets t ON (
      t.appointment_id = a.id
      OR (
        t.appointment_id IS NULL
        AND t.service_item_id = a.service_item_id
        AND (t.user_id = a.user_id OR (t.user_id IS NULL AND a.user_id IS NULL))
        AND DATE(t.created_at) = a.appointment_date
        AND (
          (a.applicant_phone IS NOT NULL AND t.applicant_phone = a.applicant_phone)
          OR (a.applicant_name IS NOT NULL AND t.applicant_name = a.applicant_name)
        )
      )
    )
    LEFT JOIN cases c ON (
      c.ticket_id = t.id
      OR (
        c.ticket_id IS NULL
        AND c.service_item_id = a.service_item_id
        AND (c.user_id = a.user_id OR (c.user_id IS NULL AND a.user_id IS NULL))
        AND datetime(c.created_at) >= datetime(a.appointment_date)
        AND datetime(c.created_at) < datetime(a.appointment_date, '+2 day')
        AND (
          (a.applicant_phone IS NOT NULL AND c.applicant_phone = a.applicant_phone)
          OR (a.applicant_name IS NOT NULL AND c.applicant_name = a.applicant_name)
        )
      )
    )
    __WHERE__
    GROUP BY ${groupBy}
    ORDER BY ${groupOrder}
  `;
}

// 总览统计
router.get('/overview', (req: AuthRequest, res) => {
  const { department_id, start_date, end_date } = req.query as any;
  
  let caseWhere = 'WHERE 1=1';
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    caseWhere += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (department_id) {
    caseWhere += ' AND c.department_id = ?';
    params.push(department_id);
  }
  if (start_date) {
    caseWhere += ' AND DATE(c.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    caseWhere += ' AND DATE(c.created_at) <= ?';
    params.push(end_date);
  }

  const totalCases = db.prepare(`SELECT COUNT(*) as count FROM cases c ${caseWhere}`).get(...params) as any;
  
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM cases c ${caseWhere} GROUP BY status
  `).all(...params) as any[];

  const completedCases = statusCounts.find((s: any) => s.status === 'completed')?.count || 0;
  const processingCases = totalCases.count - completedCases - 
    (statusCounts.find((s: any) => s.status === 'rejected')?.count || 0);

  let evalWhere = 'WHERE 1=1';
  const evalParams: any[] = [];
  
  if (req.user!.role === 'approver' && req.user!.department_id) {
    evalWhere += ' AND c.department_id = ?';
    evalParams.push(req.user!.department_id);
  }
  if (department_id) {
    evalWhere += ' AND c.department_id = ?';
    evalParams.push(department_id);
  }

  const evalStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(e.overall_rating) as avg_rating,
      SUM(CASE WHEN e.is_satisfied = 1 THEN 1 ELSE 0 END) as satisfied_count
    FROM evaluations e
    LEFT JOIN cases c ON e.case_id = c.id
    ${evalWhere}
  `).get(...evalParams) as any;

  const today = dayjs().format('YYYY-MM-DD');
  const todayCases = db.prepare(`
    SELECT COUNT(*) as count FROM cases c WHERE DATE(c.created_at) = ?
    ${department_id ? 'AND c.department_id = ?' : ''}
  `).get(today, ...(department_id ? [department_id] : [])) as any;

  res.json({
    stats: {
      total_cases: totalCases.count,
      today_cases: todayCases.count,
      processing_cases: processingCases,
      completed_cases: completedCases,
      avg_rating: evalStats.avg_rating ? Number(evalStats.avg_rating.toFixed(2)) : 0,
      satisfaction_rate: evalStats.total > 0 
        ? Number(((evalStats.satisfied_count / evalStats.total) * 100).toFixed(2))
        : 0,
      total_evaluations: evalStats.total || 0
    }
  });
});

// 办件趋势（按日/周/月）
router.get('/trend', (req: AuthRequest, res) => {
  const { department_id, type = 'day', days = 30 } = req.query as any;
  
  const dayCount = Number(days);
  const results: any[] = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    
    let sql = 'SELECT COUNT(*) as count FROM cases WHERE DATE(created_at) = ?';
    const params: any[] = [date];

    if (req.user!.role === 'approver' && req.user!.department_id) {
      sql += ' AND department_id = ?';
      params.push(req.user!.department_id);
    }
    if (department_id) {
      sql += ' AND department_id = ?';
      params.push(department_id);
    }

    const result = db.prepare(sql).get(...params) as any;
    results.push({ date, count: result.count });
  }

  res.json({ trend: results });
});

// 各科室办件统计
router.get('/by-department', (req: AuthRequest, res) => {
  const { start_date, end_date } = req.query as any;
  
  let where = 'WHERE 1=1';
  const params: any[] = [];

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
      COUNT(c.id) as total_count,
      SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN c.status IN ('reviewing', 'cross_department', 'accepting', 'submitted', 'material_reviewing', 'material_correction') THEN 1 ELSE 0 END) as processing_count
    FROM departments d
    LEFT JOIN cases c ON d.id = c.department_id
    ${where}
    GROUP BY d.id, d.name
    ORDER BY total_count DESC
  `).all(...params);

  res.json({ departments: stats });
});

// 各事项办件统计
router.get('/by-service-item', (req: AuthRequest, res) => {
  const { department_id, top = 10 } = req.query as any;
  
  let where = 'WHERE si.status = ?';
  const params: any[] = ['active'];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    where += ' AND si.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (department_id) {
    where += ' AND si.department_id = ?';
    params.push(department_id);
  }

  const stats = db.prepare(`
    SELECT 
      si.id,
      si.name,
      si.code,
      d.name as department_name,
      COUNT(c.id) as total_count
    FROM service_items si
    LEFT JOIN cases c ON si.id = c.service_item_id
    LEFT JOIN departments d ON si.department_id = d.id
    ${where}
    GROUP BY si.id, si.name, si.code, d.name
    ORDER BY total_count DESC
    LIMIT ?
  `).all(...params, Number(top));

  res.json({ service_items: stats });
});

// 评价统计（按科室）
router.get('/evaluation-by-department', (req: AuthRequest, res) => {
  const stats = db.prepare(`
    SELECT 
      d.id,
      d.name,
      COUNT(e.id) as evaluation_count,
      AVG(e.overall_rating) as avg_rating,
      SUM(CASE WHEN e.is_satisfied = 1 THEN 1 ELSE 0 END) as satisfied_count,
      CASE WHEN COUNT(e.id) > 0 
        THEN ROUND(SUM(CASE WHEN e.is_satisfied = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id), 2)
        ELSE 0 
      END as satisfaction_rate
    FROM departments d
    LEFT JOIN cases c ON d.id = c.department_id
    LEFT JOIN evaluations e ON c.id = e.case_id
    GROUP BY d.id, d.name
    ORDER BY satisfaction_rate DESC
  `).all();

  res.json({ departments: stats });
});

// 窗口效率统计
router.get('/window-efficiency', (req: AuthRequest, res) => {
  const { start_date, end_date } = req.query as any;
  
  let where = 'WHERE t.status = ?';
  const params: any[] = ['completed'];

  if (start_date) {
    where += ' AND DATE(t.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND DATE(t.created_at) <= ?';
    params.push(end_date);
  }

  const stats = db.prepare(`
    SELECT 
      w.id,
      w.name,
      w.number,
      d.name as department_name,
      COUNT(t.id) as processed_count
    FROM windows w
    LEFT JOIN departments d ON w.department_id = d.id
    LEFT JOIN tickets t ON w.id = t.window_id
    ${where}
    GROUP BY w.id, w.name, w.number, d.name
    ORDER BY processed_count DESC
  `).all(...params);

  res.json({ windows: stats });
});

// 超期办件统计
router.get('/overdue', (req: AuthRequest, res) => {
  const { department_id } = req.query as any;
  
  let where = `WHERE c.deadline IS NOT NULL 
    AND c.deadline < datetime('now')
    AND c.status NOT IN ('completed', 'rejected')`;
  const params: any[] = [];

  if (req.user!.role === 'approver' && req.user!.department_id) {
    where += ' AND c.department_id = ?';
    params.push(req.user!.department_id);
  }
  if (department_id) {
    where += ' AND c.department_id = ?';
    params.push(department_id);
  }

  const stats = db.prepare(`
    SELECT 
      c.id,
      c.case_number,
      si.name as service_item_name,
      d.name as department_name,
      c.status,
      c.deadline,
      c.created_at,
      julianday('now') - julianday(c.deadline) as overdue_days
    FROM cases c
    LEFT JOIN service_items si ON c.service_item_id = si.id
    LEFT JOIN departments d ON c.department_id = d.id
    ${where}
    ORDER BY overdue_days DESC
  `).all(...params);

  const total = stats.length;

  res.json({ cases: stats, total });
});

// 预约统计
router.get('/appointment-stats', (req: AuthRequest, res) => {
  const { department_id, start_date, end_date } = req.query as any;
  
  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (department_id) {
    where += ' AND si.department_id = ?';
    params.push(department_id);
  }
  if (start_date) {
    where += ' AND DATE(a.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND DATE(a.created_at) <= ?';
    params.push(end_date);
  }

  const stats = db.prepare(`
    SELECT 
      a.status,
      COUNT(*) as count
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    ${where}
    GROUP BY a.status
  `).all(...params);

  const result: any = {
    total: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    pending: 0
  };

  stats.forEach((s: any) => {
    result.total += s.count;
    if (result[s.status] !== undefined) {
      result[s.status] = s.count;
    }
  });

  res.json({ stats: result });
});

// 预约转化率统计
router.get('/appointment-conversion', (req: AuthRequest, res) => {
  const { department_id, start_date, end_date } = req.query as any;
  const scoped = conversionBaseWhere(req, department_id);
  let where = scoped.where;
  const params = [...scoped.params];

  if (start_date) {
    where += ' AND DATE(a.appointment_date) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND DATE(a.appointment_date) <= ?';
    params.push(end_date);
  }

  const departmentSql = appointmentConversionSelect(
    "d.id as id, COALESCE(d.name, '未分配科室') as name",
    'd.id, d.name',
    'appointment_count DESC, name ASC'
  ).replace('__WHERE__', where);

  const serviceSql = appointmentConversionSelect(
    "si.id as id, COALESCE(si.name, '未知服务事项') as name, si.code as code, COALESCE(d.name, '未分配科室') as department_name",
    'si.id, si.name, si.code, d.name',
    'appointment_count DESC, name ASC'
  ).replace('__WHERE__', where);

  const trendSql = appointmentConversionSelect(
    'DATE(a.appointment_date) as date',
    'DATE(a.appointment_date)',
    'date ASC'
  ).replace('__WHERE__', where);

  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT a.id) as appointment_count,
      COUNT(DISTINCT CASE WHEN t.id IS NOT NULL OR a.status = 'completed' THEN a.id END) as checked_in_count,
      COUNT(DISTINCT c.id) as case_count,
      COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_count,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT CASE WHEN t.id IS NOT NULL OR a.status = 'completed' THEN a.id END) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as check_in_rate,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT c.id) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as case_rate,
      CASE WHEN COUNT(DISTINCT a.id) > 0
        THEN ROUND(COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) * 100.0 / COUNT(DISTINCT a.id), 2)
        ELSE 0
      END as completion_rate
    FROM appointments a
    LEFT JOIN service_items si ON a.service_item_id = si.id
    LEFT JOIN tickets t ON (
      t.appointment_id = a.id
      OR (
        t.appointment_id IS NULL
        AND t.service_item_id = a.service_item_id
        AND (t.user_id = a.user_id OR (t.user_id IS NULL AND a.user_id IS NULL))
        AND DATE(t.created_at) = a.appointment_date
        AND (
          (a.applicant_phone IS NOT NULL AND t.applicant_phone = a.applicant_phone)
          OR (a.applicant_name IS NOT NULL AND t.applicant_name = a.applicant_name)
        )
      )
    )
    LEFT JOIN cases c ON (
      c.ticket_id = t.id
      OR (
        c.ticket_id IS NULL
        AND c.service_item_id = a.service_item_id
        AND (c.user_id = a.user_id OR (c.user_id IS NULL AND a.user_id IS NULL))
        AND datetime(c.created_at) >= datetime(a.appointment_date)
        AND datetime(c.created_at) < datetime(a.appointment_date, '+2 day')
        AND (
          (a.applicant_phone IS NOT NULL AND c.applicant_phone = a.applicant_phone)
          OR (a.applicant_name IS NOT NULL AND c.applicant_name = a.applicant_name)
        )
      )
    )
    ${where}
  `).get(...params) as any;

  const departments = db.prepare(departmentSql).all(...params) as any[];
  const serviceItems = db.prepare(serviceSql).all(...params) as any[];
  const trendRows = db.prepare(trendSql).all(...params) as any[];
  const trend = start_date && end_date
    ? Array.from({ length: dayjs(end_date).diff(dayjs(start_date), 'day') + 1 }, (_, index) => {
        const date = dayjs(start_date).add(index, 'day').format('YYYY-MM-DD');
        return trendRows.find((item: any) => item.date === date) || {
          date,
          appointment_count: 0,
          checked_in_count: 0,
          case_count: 0,
          completed_count: 0,
          check_in_rate: 0,
          case_rate: 0,
          completion_rate: 0
        };
      })
    : trendRows;

  res.json({
    summary: summary || {
      appointment_count: 0,
      checked_in_count: 0,
      case_count: 0,
      completed_count: 0,
      check_in_rate: 0,
      case_rate: 0,
      completion_rate: 0
    },
    departments,
    service_items: serviceItems,
    trend
  });
});

export default router;
