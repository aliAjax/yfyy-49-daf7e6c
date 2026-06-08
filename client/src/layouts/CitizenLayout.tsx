import { Layout, Menu, Dropdown, Avatar, Badge, Button } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  CalendarOutlined,
  StarOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import CitizenHome from '../pages/citizen/Home';
import CitizenServices from '../pages/citizen/Services';
import CitizenAppointments from '../pages/citizen/Appointments';
import CitizenCases from '../pages/citizen/Cases';
import CitizenCaseDetail from '../pages/citizen/CaseDetail';
import CitizenEvaluations from '../pages/citizen/Evaluations';
import CitizenProfile from '../pages/citizen/Profile';
import CitizenFavorites from '../pages/citizen/Favorites';
import CitizenNotifications from '../pages/citizen/Notifications';
import CaseReceiptPage from '../pages/common/CaseReceiptPage';
import { useEffect, useState } from 'react';
import api from '../api';

const { Header, Content, Sider } = Layout;

function CitizenLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res: any = await api.get('/notifications/unread-count');
      setUnreadCount(res.unread_count);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { key: '/citizen', icon: <HomeOutlined />, label: '首页' },
    { key: '/citizen/services', icon: <FileTextOutlined />, label: '服务事项' },
    { key: '/citizen/favorites', icon: <StarOutlined />, label: '我的收藏' },
    { key: '/citizen/appointments', icon: <CalendarOutlined />, label: '我的预约' },
    { key: '/citizen/cases', icon: <FileTextOutlined />, label: '我的办件' },
    { key: '/citizen/evaluations', icon: <StarOutlined />, label: '我的评价' },
    { key: '/citizen/notifications', icon: <BellOutlined />, label: '消息中心' },
    { key: '/citizen/profile', icon: <UserOutlined />, label: '个人中心' },
  ];

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  const selectedKey = '/' + location.pathname.split('/').slice(0, 3).join('/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="layout-header">
        <div className="logo">
          <span style={{ fontSize: 28 }}>🏛️</span>
          <span>政务服务大厅</span>
        </div>
        <div className="header-right">
          <Badge count={unreadCount} size="small">
            <Button
              type="text"
              icon={<BellOutlined />}
              style={{ color: 'white', fontSize: 18 }}
              onClick={() => navigate('/citizen/notifications')}
            />
          </Badge>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="user-info">
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.name}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
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
              <Route path="/" element={<CitizenHome />} />
              <Route path="/services" element={<CitizenServices />} />
              <Route path="/favorites" element={<CitizenFavorites />} />
              <Route path="/appointments" element={<CitizenAppointments />} />
              <Route path="/cases" element={<CitizenCases />} />
              <Route path="/cases/:id" element={<CitizenCaseDetail />} />
              <Route path="/cases/:id/receipt" element={<CaseReceiptPage />} />
              <Route path="/evaluations" element={<CitizenEvaluations />} />
              <Route path="/notifications" element={<CitizenNotifications onUnreadCountChange={fetchUnreadCount} />} />
              <Route path="/profile" element={<CitizenProfile />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default CitizenLayout;
