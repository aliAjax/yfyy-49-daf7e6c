import { Layout, Menu, Dropdown, Avatar, Button } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
  UserOutlined,
  AppstoreOutlined,
  NumberOutlined,
  FileTextOutlined,
  StarOutlined,
  BarChartOutlined,
  HistoryOutlined,
  SoundOutlined,
  FormOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useEffect } from 'react';
import AdminDashboard from '../pages/admin/Dashboard';
import ServiceItems from '../pages/admin/ServiceItems';
import Departments from '../pages/admin/Departments';
import Users from '../pages/admin/Users';
import Windows from '../pages/admin/Windows';
import NumberSources from '../pages/admin/NumberSources';
import AppointmentCalendar from '../pages/admin/AppointmentCalendar';
import CaseManagement from '../pages/admin/CaseManagement';
import CaseReview from '../pages/admin/CaseReview';
import TicketQueue from '../pages/admin/TicketQueue';
import Evaluations from '../pages/admin/Evaluations';
import Statistics from '../pages/admin/Statistics';
import OperationLogs from '../pages/admin/OperationLogs';
import CaseReceiptPage from '../pages/common/CaseReceiptPage';
import type { UserRole } from '../types';
import { RoleText } from '../types';

const { Header, Content, Sider } = Layout;

const menuConfig: Record<UserRole, Array<{ key: string; icon: React.ReactNode; label: string }>> = {
  admin: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/appointment-calendar', icon: <CalendarOutlined />, label: '预约日历' },
    { key: '/admin/service-items', icon: <UnorderedListOutlined />, label: '事项管理' },
    { key: '/admin/departments', icon: <ApartmentOutlined />, label: '科室管理' },
    { key: '/admin/users', icon: <UserOutlined />, label: '用户管理' },
    { key: '/admin/windows', icon: <AppstoreOutlined />, label: '窗口管理' },
    { key: '/admin/number-sources', icon: <NumberOutlined />, label: '号源管理' },
    { key: '/admin/cases', icon: <FileTextOutlined />, label: '办件管理' },
    { key: '/admin/evaluations', icon: <StarOutlined />, label: '评价管理' },
    { key: '/admin/statistics', icon: <BarChartOutlined />, label: '统计分析' },
    { key: '/admin/logs', icon: <HistoryOutlined />, label: '操作日志' },
  ],
  window: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/appointment-calendar', icon: <CalendarOutlined />, label: '预约日历' },
    { key: '/admin/calling', icon: <SoundOutlined />, label: '叫号系统' },
    { key: '/admin/case-accept', icon: <FormOutlined />, label: '办件受理' },
  ],
  approver: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/pending-approval', icon: <ClockCircleOutlined />, label: '待我审批' },
    { key: '/admin/approved', icon: <CheckCircleOutlined />, label: '我已审批' },
    { key: '/admin/overdue-warning', icon: <ClockCircleOutlined />, label: '超期预警' },
  ],
  citizen: [],
};

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'citizen') {
      navigate('/citizen');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = (user?.role || 'admin') as UserRole;
  const menuItems = menuConfig[role] || [];

  const userMenuItems = [
    {
      key: 'role',
      label: (
        <span style={{ color: '#999', fontSize: 12 }}>
          角色：{RoleText[role]}
        </span>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  const selectedKey = '/' + location.pathname.split('/').slice(0, 3).join('/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="layout-header">
        <div className="logo">
          <span style={{ fontSize: 28 }}>🏛️</span>
          <span>政务服务管理后台</span>
        </div>
        <div className="header-right">
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="user-info">
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.name}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider width={220} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout>
          <Content className="page-content">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/appointment-calendar" element={<AppointmentCalendar />} />
              <Route path="/service-items" element={<ServiceItems />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/users" element={<Users />} />
              <Route path="/windows" element={<Windows />} />
              <Route path="/number-sources" element={<NumberSources />} />
              <Route path="/cases" element={<CaseManagement />} />
              <Route path="/cases/:id/receipt" element={<CaseReceiptPage />} />
              <Route path="/evaluations" element={<Evaluations />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/calling" element={<TicketQueue />} />
              <Route path="/case-accept" element={<CaseManagement />} />
              <Route path="/pending-approval" element={<CaseReview />} />
              <Route path="/approved" element={<CaseReview />} />
              <Route path="/overdue-warning" element={<CaseReview />} />
              <Route path="/logs" element={<OperationLogs />} />
              <Route path="*" element={<AdminDashboard />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default AdminLayout;
