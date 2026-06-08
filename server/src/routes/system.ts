import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../database';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 科室管理
router.get('/departments', (req: AuthRequest, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY code').all();
  res.json({ departments });
});

router.post('/departments', requireRoles('admin'), (req: AuthRequest, res) => {
  const { name, code, description } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ message: '请填写科室名称和编码' });
  }

  const existing = db.prepare('SELECT id FROM departments WHERE code = ? OR name = ?').get(code, name);
  if (existing) {
    return res.status(400).json({ message: '科室名称或编码已存在' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)')
    .run(id, name, code, description || null);

  const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '新增科室', '科室管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `新增科室：${name}（${code}）`);

  res.status(201).json({ department });
});

router.put('/departments/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  const existing = db.prepare('SELECT id FROM departments WHERE (code = ? OR name = ?) AND id != ?')
    .get(code, name, id);
  if (existing) {
    return res.status(400).json({ message: '科室名称或编码已存在' });
  }

  const oldDept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any;
  if (!oldDept) {
    return res.status(404).json({ message: '科室不存在' });
  }

  db.prepare(`
    UPDATE departments SET name = ?, code = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, code, description || null, id);

  const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '编辑科室', '科室管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `编辑科室：${oldDept.name}（${oldDept.code}）`);

  res.json({ department });
});

router.delete('/departments/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any;
  if (!dept) {
    return res.status(404).json({ message: '科室不存在' });
  }

  const users = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?').get(id) as any;
  if (users.count > 0) {
    return res.status(400).json({ message: '该科室下还有用户，无法删除' });
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '删除科室', '科室管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `删除科室：${dept.name}（${dept.code}）`);

  res.json({ message: '删除成功' });
});

// 用户管理
router.get('/users', requireRoles('admin', 'approver'), (req: AuthRequest, res) => {
  const { role, department_id, keyword, page = 1, pageSize = 20 } = req.query as any;
  
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params: any[] = [];

  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }
  if (department_id) {
    sql += ' AND department_id = ?';
    params.push(department_id);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR username LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params) as any;
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const users = db.prepare(sql).all(...params).map((u: any) => {
    delete u.password;
    return u;
  });

  res.json({ users, total: total.count, page: Number(page), pageSize: Number(pageSize) });
});

router.post('/users', requireRoles('admin'), (req: AuthRequest, res) => {
  const { username, password, name, role, department_id, phone, email } = req.body;
  
  if (!username || !password || !name || !role) {
    return res.status(400).json({ message: '请填写必要信息' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password, name, role, department_id, phone, email, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(id, username, hashedPassword, name, role, department_id || null, phone || null, email || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  delete user.password;

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '新增用户', '用户管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `新增用户：${name}（${username}）`);

  res.status(201).json({ user });
});

router.put('/users/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, role, department_id, phone, email, status } = req.body;

  const oldUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!oldUser) {
    return res.status(404).json({ message: '用户不存在' });
  }

  db.prepare(`
    UPDATE users SET name = ?, role = ?, department_id = ?, phone = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, role, department_id || null, phone || null, email || null, status || 'active', id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  delete user.password;

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '编辑用户', '用户管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `编辑用户：${oldUser.name}（${oldUser.username}）`);

  res.json({ user });
});

router.delete('/users/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  if (id === req.user!.id) {
    return res.status(400).json({ message: '不能删除自己的账号' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '删除用户', '用户管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `删除用户：${user.name}（${user.username}）`);

  res.json({ message: '删除成功' });
});

// 窗口管理
router.get('/windows', (req: AuthRequest, res) => {
  const { department_id, status } = req.query as any;
  
  let sql = `
    SELECT w.*, d.name as department_name 
    FROM windows w 
    LEFT JOIN departments d ON w.department_id = d.id 
    WHERE 1=1
  `;
  const params: any[] = [];

  if (department_id) {
    sql += ' AND w.department_id = ?';
    params.push(department_id);
  }
  if (status) {
    sql += ' AND w.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY w.number';
  const windows = db.prepare(sql).all(...params);

  res.json({ windows });
});

router.post('/windows', requireRoles('admin'), (req: AuthRequest, res) => {
  const { name, number, department_id, status = 'open', type = 'comprehensive' } = req.body;
  
  if (!name || !number) {
    return res.status(400).json({ message: '请填写窗口名称和编号' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO windows (id, name, number, department_id, status, type) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, number, department_id || null, status, type);

  const window = db.prepare('SELECT * FROM windows WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '新增窗口', '窗口管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `新增窗口：${name}（${number}）`);

  res.status(201).json({ window });
});

router.put('/windows/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, number, department_id, status, type } = req.body;

  const oldWindow = db.prepare('SELECT * FROM windows WHERE id = ?').get(id) as any;
  if (!oldWindow) {
    return res.status(404).json({ message: '窗口不存在' });
  }

  db.prepare(`
    UPDATE windows SET name = ?, number = ?, department_id = ?, status = ?, type = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, number, department_id || null, status, type, id);

  const window = db.prepare('SELECT * FROM windows WHERE id = ?').get(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '编辑窗口', '窗口管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `编辑窗口：${oldWindow.name}（${oldWindow.number}）`);

  res.json({ window });
});

router.delete('/windows/:id', requireRoles('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  
  const window = db.prepare('SELECT * FROM windows WHERE id = ?').get(id) as any;
  if (!window) {
    return res.status(404).json({ message: '窗口不存在' });
  }

  db.prepare('DELETE FROM windows WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO operation_logs (id, user_id, user_name, action, module, detail)
    VALUES (?, ?, ?, '删除窗口', '窗口管理', ?)
  `).run(uuidv4(), req.user!.id, req.user!.name, `删除窗口：${window.name}（${window.number}）`);

  res.json({ message: '删除成功' });
});

export default router;
