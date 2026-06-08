import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

router.use(authMiddleware);

// 服务事项列表
router.get('/service-items', (req: AuthRequest, res) => {
  const { department_id, status, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = `
    SELECT si.*, d.name as department_name, w.name as window_name 
    FROM service_items si 
    LEFT JOIN departments d ON si.department_id = d.id 
    LEFT JOIN windows w ON si.window_id = w.id 
    WHERE 1=1
  `;
  const params: any[] = [];

  if (department_id) {
    sql += ' AND si.department_id = ?';
    params.push(department_id);
  }
  if (status) {
    sql += ' AND si.status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (si.name LIKE ? OR si.code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace('SELECT si.*, d.name as department_name, w.name as window_name', 'SELECT COUNT(*) as count'))
    .get(...params) as any;
  
  sql += ' ORDER BY si.sort_order ASC, si.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const items = db.prepare(sql).all(...params);

  res.json({ items, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

// 所有启用的服务事项（群众端使用）
router.get('/service-items/all', (req: AuthRequest, res) => {
  const items = db.prepare(`
    SELECT si.*, d.name as department_name, w.name as window_name
    FROM service_items si
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN windows w ON si.window_id = w.id
    WHERE si.status = 'active'
    ORDER BY si.sort_order ASC, si.created_at DESC
  `).all();

  res.json({ items });
});

// 服务事项详情
router.get('/service-items/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const item = db.prepare(`
    SELECT si.*, d.name as department_name, w.name as window_name
    FROM service_items si
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN windows w ON si.window_id = w.id
    WHERE si.id = ?
  `).get(id) as any;

  if (!item) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  const materialList = db.prepare(`
    SELECT * FROM service_item_materials 
    WHERE service_item_id = ? 
    ORDER BY sort_order ASC, created_at ASC
  `).all(id);

  item.material_list = materialList.length > 0 ? materialList : null;

  res.json({ item });
});

// 创建服务事项
router.post('/service-items', requireRoles('admin'), (req: AuthRequest, res) => {
  const { name, code, department_id, window_id, description, materials, processing_time, fee, sort_order = 0 } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ message: '请填写事项名称和编码' });
  }

  const existing = db.prepare('SELECT id FROM service_items WHERE code = ?').get(code);
  if (existing) {
    return res.status(400).json({ message: '事项编码已存在' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO service_items (id, name, code, department_id, window_id, description, materials, processing_time, fee, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(id, name, code, department_id || null, window_id || null, description || null, materials || null, 
       processing_time || null, fee || null, sort_order);

  const item = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '新增事项', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `新增事项：${name}（${code}）`);

  res.status(201).json({ item });
});

// 更新服务事项
router.put('/service-items/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, code, department_id, window_id, description, materials, processing_time, fee, status, sort_order } = req.body;

  const existing = db.prepare('SELECT id FROM service_items WHERE code = ? AND id != ?').get(code, id);
  if (existing) {
    return res.status(400).json({ message: '事项编码已存在' });
  }

  const oldItem = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id) as any;
  if (!oldItem) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  db.prepare(`
    UPDATE service_items SET name = ?, code = ?, department_id = ?, window_id = ?, description = ?, 
      materials = ?, processing_time = ?, fee = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, code, department_id || null, window_id || null, description || null, materials || null,
       processing_time || null, fee || null, status || 'active', sort_order || 0, id);

  const item = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '编辑事项', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `编辑事项：${oldItem.name}（${oldItem.code}）`);

  res.json({ item });
});

// 删除服务事项
router.delete('/service-items/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const item = db.prepare('SELECT * FROM service_items WHERE id = ?').get(id) as any;
  if (!item) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  db.prepare('DELETE FROM service_items WHERE id = ?').run(id);
  db.prepare('DELETE FROM number_sources WHERE service_item_id = ?').run(id);
  db.prepare('DELETE FROM service_item_materials WHERE service_item_id = ?').run(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '删除事项', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `删除事项：${item.name}（${item.code}）`);

  res.json({ message: '删除成功' });
});

// 获取服务事项材料清单
router.get('/service-items/:id/materials', (req: AuthRequest, res) => {
  const { id } = req.params;

  const serviceItem = db.prepare('SELECT id FROM service_items WHERE id = ?').get(id);
  if (!serviceItem) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  const materials = db.prepare(`
    SELECT * FROM service_item_materials 
    WHERE service_item_id = ? 
    ORDER BY sort_order ASC, created_at ASC
  `).all(id);

  res.json({ materials });
});

// 新增服务事项材料
router.post('/service-items/:id/materials', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, is_required = 1, description, example, sort_order = 0 } = req.body;

  if (!name) {
    return res.status(400).json({ message: '请填写材料名称' });
  }

  const serviceItem = db.prepare('SELECT id, name FROM service_items WHERE id = ?').get(id) as any;
  if (!serviceItem) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  const materialId = uuidv4();
  db.prepare(`
    INSERT INTO service_item_materials (id, service_item_id, name, is_required, description, example, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(materialId, id, name, is_required ? 1 : 0, description || null, example || null, sort_order);

  const material = db.prepare('SELECT * FROM service_item_materials WHERE id = ?').get(materialId);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '新增材料', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `为事项【${serviceItem.name}】新增材料：${name}`);

  res.status(201).json({ material });
});

// 更新服务事项材料
router.put('/service-item-materials/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, is_required, description, example, sort_order } = req.body;

  const oldMaterial = db.prepare('SELECT * FROM service_item_materials WHERE id = ?').get(id) as any;
  if (!oldMaterial) {
    return res.status(404).json({ message: '材料不存在' });
  }

  db.prepare(`
    UPDATE service_item_materials SET 
      name = ?, is_required = ?, description = ?, example = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name !== undefined ? name : oldMaterial.name,
    is_required !== undefined ? (is_required ? 1 : 0) : oldMaterial.is_required,
    description !== undefined ? description : oldMaterial.description,
    example !== undefined ? example : oldMaterial.example,
    sort_order !== undefined ? sort_order : oldMaterial.sort_order,
    id
  );

  const material = db.prepare('SELECT * FROM service_item_materials WHERE id = ?').get(id);

  const serviceItem = db.prepare('SELECT name FROM service_items WHERE id = ?').get(oldMaterial.service_item_id) as any;
  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '编辑材料', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `编辑事项【${serviceItem?.name}】的材料：${oldMaterial.name}`);

  res.json({ material });
});

// 删除服务事项材料
router.delete('/service-item-materials/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;

  const material = db.prepare('SELECT * FROM service_item_materials WHERE id = ?').get(id) as any;
  if (!material) {
    return res.status(404).json({ message: '材料不存在' });
  }

  db.prepare('DELETE FROM service_item_materials WHERE id = ?').run(id);

  const serviceItem = db.prepare('SELECT name FROM service_items WHERE id = ?').get(material.service_item_id) as any;
  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '删除材料', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `删除事项【${serviceItem?.name}】的材料：${material.name}`);

  res.json({ message: '删除成功' });
});

// 批量更新材料排序
router.post('/service-items/:id/materials/sort', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { materials } = req.body;

  if (!Array.isArray(materials)) {
    return res.status(400).json({ message: '参数错误' });
  }

  const serviceItem = db.prepare('SELECT name FROM service_items WHERE id = ?').get(id) as any;
  if (!serviceItem) {
    return res.status(404).json({ message: '服务事项不存在' });
  }

  const stmt = db.prepare('UPDATE service_item_materials SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((items: any[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });

  updateMany(materials.map((m: any) => ({ id: m.id, sort_order: m.sort_order })));

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '排序材料', '事项管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `调整事项【${serviceItem.name}】的材料排序`);

  res.json({ message: '排序成功' });
});

// 号源管理 - 获取某天的号源
router.get('/number-sources', (req: AuthRequest, res) => {
  const { service_item_id, date, start_date, end_date } = req.query as any;
  
  let sql = 'SELECT * FROM number_sources WHERE 1=1';
  const params: any[] = [];

  if (service_item_id) {
    sql += ' AND service_item_id = ?';
    params.push(service_item_id);
  }
  if (date) {
    sql += ' AND date = ?';
    params.push(date);
  }
  if (start_date && end_date) {
    sql += ' AND date >= ? AND date <= ?';
    params.push(start_date, end_date);
  }

  sql += ' ORDER BY date';
  const sources = db.prepare(sql).all(...params);

  res.json({ sources });
});

// 生成号源
router.post('/number-sources/generate', requireRoles('admin'), (req: AuthRequest, res) => {
  const { service_item_id, start_date, end_date, total_count, time_slots } = req.body;
  
  if (!service_item_id || !start_date || !end_date || !total_count) {
    return res.status(400).json({ message: '请填写完整信息' });
  }

  const serviceItem = db.prepare('SELECT * FROM service_items WHERE id = ?').get(service_item_id) as any;
  if (!serviceItem) {
    return res.status(400).json({ message: '服务事项不存在' });
  }

  const start = dayjs(start_date);
  const end = dayjs(end_date);
  
  if (start.isAfter(end)) {
    return res.status(400).json({ message: '开始日期不能晚于结束日期' });
  }

  const days = end.diff(start, 'day') + 1;
  let generated = 0;

  for (let i = 0; i < days; i++) {
    const date = start.add(i, 'day').format('YYYY-MM-DD');
    
    const existing = db.prepare('SELECT id FROM number_sources WHERE service_item_id = ? AND date = ?')
      .get(service_item_id, date);
    
    if (!existing) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO number_sources (id, service_item_id, date, total_count, booked_count, time_slots)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(id, service_item_id, date, total_count, time_slots || null);
      generated++;
    }
  }

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '生成号源', '号源管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `生成号源：${serviceItem.name}，${start_date} 至 ${end_date}，共 ${generated} 天，每日 ${total_count} 个`);

  res.json({ message: `成功生成 ${generated} 天的号源`, generated });
});

// 更新号源
router.put('/number-sources/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { total_count, time_slots } = req.body;

  const source = db.prepare('SELECT * FROM number_sources WHERE id = ?').get(id) as any;
  if (!source) {
    return res.status(404).json({ message: '号源不存在' });
  }

  if (total_count < source.booked_count) {
    return res.status(400).json({ message: '总号源数不能小于已预约数' });
  }

  db.prepare(`
    UPDATE number_sources SET total_count = ?, time_slots = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(total_count, time_slots || null, id);

  const updated = db.prepare('SELECT * FROM number_sources WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '更新号源', '号源管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `更新号源：日期 ${source.date}，总号源数 ${total_count}`);

  res.json({ source: updated });
});

// 获取可用号源日期
router.get('/available-dates', (req: AuthRequest, res) => {
  const { service_item_id } = req.query as any;
  
  const today = dayjs().format('YYYY-MM-DD');
  
  const sources = db.prepare(`
    SELECT date, total_count, booked_count 
    FROM number_sources 
    WHERE service_item_id = ? AND date >= ? AND booked_count < total_count
    ORDER BY date
    LIMIT 30
  `).all(service_item_id, today);

  res.json({ dates: sources });
});

// 获取我的常用/推荐服务事项
router.get('/recommended', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { limit = 6 } = req.query as any;
  const limitNum = Math.min(Math.max(Number(limit), 1), 20);

  const appointmentCounts = db.prepare(`
    SELECT service_item_id, COUNT(*) as count, MAX(created_at) as last_time
    FROM appointments
    WHERE user_id = ? AND status != 'cancelled'
    GROUP BY service_item_id
  `).all(userId) as any[];

  const caseCounts = db.prepare(`
    SELECT service_item_id, COUNT(*) as count, MAX(created_at) as last_time
    FROM cases
    WHERE user_id = ?
    GROUP BY service_item_id
  `).all(userId) as any[];

  const favorites = db.prepare(`
    SELECT service_item_id, created_at as last_time
    FROM favorites
    WHERE user_id = ?
  `).all(userId) as any[];

  const scoreMap: Record<string, { score: number; last_time: string; favorite: boolean }> = {};

  appointmentCounts.forEach((item) => {
    const id = item.service_item_id;
    if (!scoreMap[id]) {
      scoreMap[id] = { score: 0, last_time: item.last_time, favorite: false };
    }
    scoreMap[id].score += item.count * 2;
    if (item.last_time > scoreMap[id].last_time) {
      scoreMap[id].last_time = item.last_time;
    }
  });

  caseCounts.forEach((item) => {
    const id = item.service_item_id;
    if (!scoreMap[id]) {
      scoreMap[id] = { score: 0, last_time: item.last_time, favorite: false };
    }
    scoreMap[id].score += item.count * 2;
    if (item.last_time > scoreMap[id].last_time) {
      scoreMap[id].last_time = item.last_time;
    }
  });

  favorites.forEach((item) => {
    const id = item.service_item_id;
    if (!scoreMap[id]) {
      scoreMap[id] = { score: 0, last_time: item.last_time, favorite: false };
    }
    scoreMap[id].score += 3;
    scoreMap[id].favorite = true;
    if (item.last_time > scoreMap[id].last_time) {
      scoreMap[id].last_time = item.last_time;
    }
  });

  const serviceIds = Object.keys(scoreMap);
  if (serviceIds.length === 0) {
    return res.json({ items: [], has_history: false });
  }

  const placeholders = serviceIds.map(() => '?').join(',');
  const serviceItems = db.prepare(`
    SELECT si.*, d.name as department_name, w.name as window_name
    FROM service_items si
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN windows w ON si.window_id = w.id
    WHERE si.id IN (${placeholders}) AND si.status = 'active'
  `).all(...serviceIds) as any[];

  const scoredItems = serviceItems
    .map((item) => ({
      ...item,
      score: scoreMap[item.id]?.score || 0,
      last_time: scoreMap[item.id]?.last_time || '',
      is_favorite: scoreMap[item.id]?.favorite || false,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.last_time.localeCompare(a.last_time);
    })
    .slice(0, limitNum);

  res.json({ items: scoredItems, has_history: true });
});

export default router;
