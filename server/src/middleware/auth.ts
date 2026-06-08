import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database';
import type { User } from '../types';

export const JWT_SECRET = 'gov-service-hall-secret-key-2024';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, department_id: user.department_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id) as User;
    
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: '账号已被禁用' });
    }
    
    delete (user as any).password;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: '认证令牌无效或已过期' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    next();
  };
}
