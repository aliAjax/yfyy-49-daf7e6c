import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, generateToken, AuthRequest, requireRoles } from '../middleware/auth';
import type { User } from '../types';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User;
  
  if (!user) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: '账号已被禁用，请联系管理员' });
  }

  const isValid = bcrypt.compareSync(password, user.password!);
  
  if (!isValid) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  const token = generateToken(user);
  
  const userData = { ...user };
  delete (userData as any).password;

  db.prepare('INSERT INTO operation_logs (user_id, user_name, action, module, detail) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, user.name, '登录', '认证', '用户登录系统');

  res.json({ token, user: userData });
});

router.post('/register', (req, res) => {
  const { username, password, name, phone, id_card } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ message: '请填写必要信息' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password, name, phone, id_card, role, status)
    VALUES (?, ?, ?, ?, ?, ?, 'citizen', 'active')
  `).run(id, username, hashedPassword, name, phone || null, id_card || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
  delete (user as any).password;

  res.status(201).json({ user });
});

router.get('/profile', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authMiddleware, (req: AuthRequest, res) => {
  const { name, phone, email, avatar } = req.body;
  
  db.prepare(`
    UPDATE users SET name = ?, phone = ?, email = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name || req.user!.name, phone || null, email || null, avatar || null, req.user!.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as User;
  delete (user as any).password;

  res.json({ user });
});

router.post('/change-password', authMiddleware, (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as User;
  
  if (!bcrypt.compareSync(oldPassword, user.password!)) {
    return res.status(400).json({ message: '原密码错误' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashedPassword, req.user!.id);

  res.json({ message: '密码修改成功' });
});

export default router;
