import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import serviceRoutes from './routes/service';
import appointmentRoutes from './routes/appointment';
import ticketRoutes from './routes/ticket';
import caseRoutes from './routes/case';
import evaluationRoutes from './routes/evaluation';
import statisticsRoutes from './routes/statistics';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notification';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '政务服务大厅管理系统 API 运行正常' });
});

app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 政务服务大厅管理系统后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API 路径: http://localhost:${PORT}/api`);
});

export default app;
