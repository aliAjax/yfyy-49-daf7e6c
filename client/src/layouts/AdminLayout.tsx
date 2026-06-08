import { Layout, Menu, Dropdown, Avatar, Button, Badge, Spin } from 'antd';
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
  SwapOutlined,
  WarningOutlined,
  BellOutlined,
  DesktopOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useState, useEffect } from 'react';
import api from '../api';
import AdminDashboard from '../pages/admin/Dashboard';
import ServiceItems from '../pages/admin/ServiceItems';
import Departments from '../pages/admin/Departments';
import Users from '../pages/admin/Users';
import Windows from '../pages/admin/Windows';
import NumberSources from '../pages/admin/NumberSources';
import AppointmentCalendar from '../pages/admin/AppointmentCalendar';
import CaseManagement from '../pages/admin/CaseManagement';
import CaseReview from '../pages/admin/CaseReview';
import CaseCollaboration from '../pages/admin/CaseCollaboration';
import TicketQueue from '../pages/admin/TicketQueue';
import Evaluations from '../pages/admin/Evaluations';
import Statistics from '../pages/admin/Statistics';
import OperationLogs from '../pages/admin/OperationLogs';
import CaseReceiptPage from '../pages/common/CaseReceiptPage';
import OverdueWarningCenter from '../pages/admin/OverdueWarningCenter';
import AdminNotifications from '../pages/admin/Notifications';
import type { UserRole } from '../types';
import { RoleText } from '../types';

const { Header, Content, Sider } = Layout;

interface MenuItemConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}

const menuConfig: Record<UserRole, MenuItemConfig[]> = {
  admin: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/appointment-calendar', icon: <CalendarOutlined />, label: '预约日历' },
    { key: '/admin/service-items', icon: <UnorderedListOutlined />, label: '事项管理' },
    { key: '/admin/departments', icon: <ApartmentOutlined />, label: '科室管理' },
    { key: '/admin/users', icon: <UserOutlined />, label: '用户管理' },
    { key: '/admin/windows', icon: <AppstoreOutlined />, label: '窗口管理' },
    { key: '/admin/number-sources', icon: <NumberOutlined />, label: '号源管理' },
    { key: '/admin/cases', icon: <FileTextOutlined />, label: '办件管理' },
    { key: '/admin/collaboration', icon: <SwapOutlined />, label: '协同待办' },
    { key: '/admin/overdue-warning', icon: <WarningOutlined />, label: '超期预警中心' },
    { key: '/admin/evaluations', icon: <StarOutlined />, label: '评价管理' },
    { key: '/admin/statistics', icon: <BarChartOutlined />, label: '统计分析' },
    { key: '/admin/logs', icon: <HistoryOutlined />, label: '操作日志' },
    { key: '/display', icon: <DesktopOutlined />, label: '叫号大屏', external: true },
  ],
  window: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/appointment-calendar', icon: <CalendarOutlined />, label: '预约日历' },
    { key: '/admin/calling', icon: <SoundOutlined />, label: '叫号系统' },
    { key: '/admin/case-accept', icon: <FormOutlined />, label: '办件受理' },
    { key: '/admin/overdue-warning', icon: <WarningOutlined />, label: '超期预警中心' },
    { key: '/display', icon: <DesktopOutlined />, label: '叫号大屏', external: true },
  ],
  approver: [
    { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/admin/pending-approval', icon: <ClockCircleOutlined />, label: '待我审批' },
    { key: '/admin/collaboration', icon: <SwapOutlined />, label: '协同待办' },
    { key: '/admin/approved', icon: <CheckCircleOutlined />, label: '我已审批' },
    { key: '/admin/overdue-warning', icon: <WarningOutlined />, label: '超期预警中心' },
  ],
  citizen: [],
};

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res: any = await api.get('/notifications/unread-count');
      setUnreadCount(res.count || 0);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'citizen') {
      fetchUnreadCount();
      const timer = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(timer);
    }
  }, [user]);

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
  const menuItems = (menuConfig[role] || []).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.external ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.label}
        <ExportOutlined style={{ fontSize: 12 }} />
      </span>
    ) : (
      item.label
    ),
    external: item.external,
  }));

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
          <Button
            type="text"
            icon={
              <Badge count={unreadCount} size="small" offset={[2, 2]}>
                <BellOutlined style={{ fontSize: 18 }} />
              </Badge>
            }
            onClick={() => navigate('/admin/notifications')}
            style={{ marginRight: 16 }}
          />
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
            onClick={({ key }) => {
              const item = menuConfig[role]?.find((i) => i.key === key);
              if (item?.external) {
                window.open(key, '_blank');
              } else {
                navigate(key);
              }
            }}
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
              <Route path="/collaboration" element={<CaseCollaboration />} />
              <Route path="/approved" element={<CaseReview />} />
              <Route path="/overdue-warning" element={<OverdueWarningCenter />} />
              <Route path="/notifications" element={<AdminNotifications onUnreadCountChange={fetchUnreadCount} />} />
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
